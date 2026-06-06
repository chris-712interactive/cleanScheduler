import { positiveAmountCents } from '@/lib/billing/resolveVisitExpectedAmount';
import { findStaffedVisitWindow } from '@/lib/schedule/findStaffedVisitWindow';
import { computeNextWorkDayVisitWindow } from '@/lib/schedule/nextWorkDayVisitWindow';
import { offsetVisitWindowByFrequency } from '@/lib/schedule/offsetVisitWindowByFrequency';
import type { Database } from '@/lib/supabase/database.types';
import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import {
  isRecurringQuoteLineFrequency,
  resolveAutoScheduleVisitCount,
} from '@/lib/tenant/quoteLineAutoSchedule';
import { effectiveLineSubtotalCents } from '@/lib/tenant/quoteTotals';
import {
  findCatalogEntry,
  loadJobTypeCatalog,
  resolveVisitDurationHours,
  type JobTypeCatalogEntry,
} from '@/lib/tenant/jobTypeCatalog';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { tenantBusinessSnapshotFromRow } from '@/lib/tenant/tenantBusinessSettings';
import {
  avoidSameDayRecurringStart,
  maxIsoTimestamp,
  partitionAutoScheduleLines,
  resolveRecurringFirstVisitNotBefore,
  resolveScheduleVisitTitle,
  type QuoteAutoScheduleLine,
  type QuoteAutoScheduleSettings,
} from '@/lib/tenant/quoteAutoSchedulePlan';
import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient<Database>;

type FlaggedLine = {
  id: string;
  sort_order: number;
  service_label: string;
  frequency: QuoteLineFrequency;
  amount_cents: number;
  line_discount_kind: Database['public']['Enums']['quote_line_discount_kind'];
  line_discount_value: number;
  auto_schedule_visit_count: number | null;
  estimated_hours: number | null;
  service_template_id: string | null;
};

export interface AutoScheduleVisitInput {
  tenantId: string;
  quoteId: string;
  customerId: string;
  quoteTitle: string;
}

export interface AutoScheduleVisitResult {
  visitIds?: string[];
  createdCount?: number;
  skippedReason?: string;
  alreadyScheduled?: boolean;
}

type ScheduleContext = {
  admin: Admin;
  input: AutoScheduleVisitInput;
  quotePropertyId: string | null;
  propertyKind: CustomerPropertyKind | null;
  business: ReturnType<typeof tenantBusinessSnapshotFromRow>;
  catalog: JobTypeCatalogEntry[];
  catalogById: Map<string, JobTypeCatalogEntry>;
  scheduleSettings: QuoteAutoScheduleSettings;
};

/**
 * Creates scheduled visits for flagged quote line items when the tenant uses
 * auto-scheduling. Idempotent per (quote_line_item_id, auto_schedule_sequence).
 */
export async function ensureAutoScheduledVisitForAcceptedQuote(
  admin: Admin,
  input: AutoScheduleVisitInput,
): Promise<AutoScheduleVisitResult> {
  if (!input.customerId) {
    return { skippedReason: 'missing_customer' };
  }

  const [{ data: quoteRow }, lineItemsRes, { data: tenantRow }, { data: opsRow }] =
    await Promise.all([
      admin
        .from('tenant_quotes')
        .select('property_id, job_type')
        .eq('id', input.quoteId)
        .eq('tenant_id', input.tenantId)
        .maybeSingle(),
      admin
        .from('tenant_quote_line_items')
        .select(
          `
        id,
        sort_order,
        service_label,
        frequency,
        amount_cents,
        line_discount_kind,
        line_discount_value,
        auto_schedule_on_accept,
        auto_schedule_visit_count,
        estimated_hours,
        service_template_id
      `,
        )
        .eq('quote_id', input.quoteId)
        .order('sort_order'),
      admin
        .from('tenants')
        .select(
          'timezone, work_week_days, work_day_start, work_day_end, name, business_email, business_phone, brand_color, logo_url, address_line1, city, state, postal_code, country',
        )
        .eq('id', input.tenantId)
        .maybeSingle(),
      admin
        .from('tenant_operational_settings')
        .select('recurring_starts_after_initial, allow_same_day_initial_recurring')
        .eq('tenant_id', input.tenantId)
        .maybeSingle(),
    ]);

  if (lineItemsRes.error) {
    console.error('[quoteAutoSchedule] line items load failed:', lineItemsRes.error.message);
    return { skippedReason: 'line_items_load_failed' };
  }

  const flaggedLines = (lineItemsRes.data ?? []).filter(
    (line) => line.auto_schedule_on_accept,
  ) as FlaggedLine[];

  if (flaggedLines.length === 0) {
    return { skippedReason: 'no_lines_flagged' };
  }

  if (!tenantRow) {
    return { skippedReason: 'tenant_not_found' };
  }

  let propertyKind: CustomerPropertyKind | null = quoteRow?.job_type ?? null;
  if (!propertyKind && quoteRow?.property_id) {
    const { data: propertyRow } = await admin
      .from('tenant_customer_properties')
      .select('property_kind')
      .eq('id', quoteRow.property_id)
      .maybeSingle();
    propertyKind = (propertyRow?.property_kind as CustomerPropertyKind | null) ?? null;
  }

  const catalog = await loadJobTypeCatalog(admin, input.tenantId, {
    propertyKind,
    activeOnly: true,
  });
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));

  const business = tenantBusinessSnapshotFromRow({
    name: tenantRow.name,
    timezone: tenantRow.timezone,
    business_email: tenantRow.business_email,
    business_phone: tenantRow.business_phone,
    brand_color: tenantRow.brand_color,
    logo_url: tenantRow.logo_url,
    address_line1: tenantRow.address_line1,
    city: tenantRow.city,
    state: tenantRow.state,
    postal_code: tenantRow.postal_code,
    country: tenantRow.country,
    work_week_days: tenantRow.work_week_days,
    work_day_start: tenantRow.work_day_start,
    work_day_end: tenantRow.work_day_end,
  });

  const scheduleSettings: QuoteAutoScheduleSettings = {
    recurringStartsAfterInitial: opsRow?.recurring_starts_after_initial ?? true,
    allowSameDayInitialRecurring: opsRow?.allow_same_day_initial_recurring ?? false,
  };

  const ctx: ScheduleContext = {
    admin,
    input,
    quotePropertyId: quoteRow?.property_id ?? null,
    propertyKind,
    business,
    catalog,
    catalogById,
    scheduleSettings,
  };

  const visitIds: string[] = [];
  let createdCount = 0;
  let anchorStartIso: string | null = null;

  const toScheduleLine = (line: FlaggedLine): QuoteAutoScheduleLine => ({
    id: line.id,
    sort_order: line.sort_order,
    service_label: line.service_label,
    display_title: null,
    frequency: line.frequency,
    service_template_id: line.service_template_id,
  });

  if (scheduleSettings.recurringStartsAfterInitial) {
    const scheduleLines = flaggedLines.map(toScheduleLine);
    const { initialLines, recurringLines } = partitionAutoScheduleLines(scheduleLines, catalogById);

    for (const [lineIndex, line] of initialLines.entries()) {
      const flagged = flaggedLines.find((row) => row.id === line.id);
      if (!flagged) continue;
      const result = await scheduleFlaggedLineVisits(ctx, flagged, {
        lineIndex,
        recurringNotBeforeIso: null,
        visitIds,
      });
      createdCount += result.createdCount;
      if (result.latestVisitStartIso) {
        anchorStartIso = maxIsoTimestamp(anchorStartIso, result.latestVisitStartIso);
      }
    }

    for (const [lineIndex, line] of recurringLines.entries()) {
      const flagged = flaggedLines.find((row) => row.id === line.id);
      if (!flagged) continue;
      let recurringNotBeforeIso = resolveRecurringFirstVisitNotBefore(
        anchorStartIso,
        flagged.frequency,
        scheduleSettings,
      );
      if (recurringNotBeforeIso) {
        recurringNotBeforeIso = avoidSameDayRecurringStart(
          anchorStartIso,
          recurringNotBeforeIso,
          scheduleSettings,
        );
      }
      const result = await scheduleFlaggedLineVisits(ctx, flagged, {
        lineIndex,
        recurringNotBeforeIso,
        visitIds,
      });
      createdCount += result.createdCount;
    }
  } else {
    for (const [lineIndex, line] of flaggedLines.entries()) {
      const result = await scheduleFlaggedLineVisits(ctx, line, {
        lineIndex,
        recurringNotBeforeIso: null,
        visitIds,
      });
      createdCount += result.createdCount;
    }
  }

  if (visitIds.length === 0) {
    return { skippedReason: 'visit_create_failed' };
  }

  return {
    visitIds,
    createdCount,
    alreadyScheduled: createdCount === 0,
  };
}

async function scheduleFlaggedLineVisits(
  ctx: ScheduleContext,
  line: FlaggedLine,
  options: {
    lineIndex: number;
    recurringNotBeforeIso: string | null;
    visitIds: string[];
  },
): Promise<{ createdCount: number; latestVisitStartIso: string | null }> {
  const visitCount = resolveAutoScheduleVisitCount(line.frequency, line.auto_schedule_visit_count);
  const lineAmountCents = positiveAmountCents(
    effectiveLineSubtotalCents({
      amount_cents: line.amount_cents,
      line_discount_kind: line.line_discount_kind,
      line_discount_value: line.line_discount_value,
    }),
  );

  const catalogEntry = findCatalogEntry(ctx.catalog, {
    serviceTemplateId: line.service_template_id,
    serviceLabel: line.service_label,
    propertyKind: ctx.propertyKind,
  });
  const durationHours = resolveVisitDurationHours({
    lineEstimatedHours: line.estimated_hours,
    catalogEntry,
  });

  const baseWindow = computeNextWorkDayVisitWindow({
    timezone: ctx.business.timezone,
    workWeekDays: ctx.business.workWeekDays,
    workDayStart: ctx.business.workDayStart,
    workDayEnd: ctx.business.workDayEnd,
    startAfterDays: options.lineIndex,
    durationHours,
  });

  let createdCount = 0;
  let latestVisitStartIso: string | null = null;

  for (let sequence = 0; sequence < visitCount; sequence += 1) {
    const autoScheduleSequence = sequence + 1;

    const { data: existingVisit } = await ctx.admin
      .from('tenant_scheduled_visits')
      .select('id, starts_at')
      .eq('quote_line_item_id', line.id)
      .eq('auto_schedule_sequence', autoScheduleSequence)
      .maybeSingle();

    if (existingVisit?.id) {
      options.visitIds.push(existingVisit.id);
      latestVisitStartIso = maxIsoTimestamp(latestVisitStartIso, existingVisit.starts_at);
      continue;
    }

    const anchorWindow = offsetVisitWindowByFrequency(
      { startsAt: baseWindow.startsAt, endsAt: baseWindow.endsAt },
      sequence,
      line.frequency,
    );

    const recurringFloor =
      sequence === 0 && options.recurringNotBeforeIso
        ? new Date(options.recurringNotBeforeIso).getTime()
        : null;

    const searchNotBefore = new Date(
      Math.max(
        Date.now(),
        recurringFloor ?? new Date(anchorWindow.startsAt).getTime() - 24 * 3_600_000,
      ),
    );

    const staffed = await findStaffedVisitWindow(ctx.admin, {
      tenantId: ctx.input.tenantId,
      timezone: ctx.business.timezone,
      workWeekDays: ctx.business.workWeekDays,
      workDayStart: ctx.business.workDayStart,
      workDayEnd: ctx.business.workDayEnd,
      durationHours,
      startAfterDays: sequence === 0 ? options.lineIndex : 0,
      searchNotBefore,
    });

    const window = staffed ? { startsAt: staffed.startsAt, endsAt: staffed.endsAt } : anchorWindow;
    const assigneeUserId = staffed?.assigneeUserId ?? null;
    const staffingStatus = assigneeUserId ? 'assigned' : 'needs_staffing';

    const visitTitle =
      resolveScheduleVisitTitle(line, catalogEntry) || ctx.input.quoteTitle.trim() || 'Visit';
    const sequenceNote =
      visitCount > 1 && isRecurringQuoteLineFrequency(line.frequency)
        ? ` (${autoScheduleSequence} of ${visitCount})`
        : '';

    const { data: created, error } = await ctx.admin
      .from('tenant_scheduled_visits')
      .insert({
        tenant_id: ctx.input.tenantId,
        customer_id: ctx.input.customerId,
        property_id: ctx.quotePropertyId,
        quote_id: ctx.input.quoteId,
        quote_line_item_id: line.id,
        auto_schedule_sequence: autoScheduleSequence,
        title: `${visitTitle}${sequenceNote}`.slice(0, 200),
        starts_at: window.startsAt,
        ends_at: window.endsAt,
        status: 'scheduled',
        staffing_status: staffingStatus,
        expected_amount_cents: lineAmountCents,
        notes: assigneeUserId
          ? 'Scheduled automatically when the customer accepted this quote.'
          : 'Scheduled automatically — no crew slot was found in the next 28 days that matches business and employee availability. Assign someone from the schedule.',
      })
      .select('id')
      .single();

    if (error || !created) {
      console.error('[quoteAutoSchedule] visit create failed:', error?.message);
      continue;
    }

    if (assigneeUserId) {
      await ctx.admin.from('tenant_scheduled_visit_assignees').insert({
        visit_id: created.id,
        user_id: assigneeUserId,
      });
    }

    options.visitIds.push(created.id);
    createdCount += 1;
    latestVisitStartIso = maxIsoTimestamp(latestVisitStartIso, window.startsAt);
  }

  return { createdCount, latestVisitStartIso };
}

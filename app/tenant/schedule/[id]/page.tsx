import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { normalizeAssigneeRows } from '@/lib/schedule/mapAssigneeChips';
import { isVisitAssignee } from '@/lib/schedule/visitFieldWork';
import type { TenantRole } from '@/lib/auth/types';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import { getVisitRelatedRecords } from '@/lib/tenant/relatedRecords';
import { VisitDetailCard } from '../VisitDetailCard';
import { createAdminClient } from '@/lib/supabase/server';
import { resolveVisitDurationForVisit } from '@/lib/schedule/resolveVisitDurationForVisit';
import { DEFAULT_VISIT_DURATION_HOURS } from '@/lib/schedule/visitDuration';
import { SCHEDULE_ISSUES_TAB_HREF } from '@/lib/tenant/scheduleIssuesQueue';
import { listVisitProofPhotos } from '@/lib/visits/visitProofPhotos';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import styles from '../visitDetail.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantVisitDetailPage({ params, searchParams }: PageProps) {
  const { id: rawId } = await params;
  const sp = await searchParams;
  const fromIssues = sp.from === 'issues';
  const visitId = rawId.trim();
  if (!UUID_RE.test(visitId)) notFound();

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/schedule/${visitId}`);
  const auth = await getAuthContext();
  const actorUserId = auth?.user.id ?? '';
  const actorRole = membership.role as TenantRole;
  const isFieldEmployee = isFieldEmployeeRole(actorRole);

  const supabase = createTenantPortalDbClient();
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();
  const tenantTimezone = tenantRow?.timezone ?? 'America/New_York';

  const { data: row, error } = await supabase
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      title,
      starts_at,
      ends_at,
      status,
      notes,
      customer_id,
      checked_in_at,
      checked_in_by_user_id,
      check_in_lat,
      check_in_lng,
      check_in_accuracy_m,
      check_in_location_status,
      completed_at,
      completed_by_user_id,
      completion_payment_collected,
      completion_collected_method,
      completion_check_number,
      completion_collected_amount_cents,
      completion_invoice_id,
      quote_id,
      expected_amount_cents,
      visit_purpose,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name,
          phone,
          email
        ),
        tenant_customer_profiles (
          preferred_payment_method
        )
      ),
      tenant_customer_properties (
        label,
        address_line1,
        address_line2,
        city,
        state,
        postal_code
      ),
      tenant_quotes ( title, amount_cents ),
      tenant_scheduled_visit_assignees (
        user_id,
        user_profiles ( display_name, avatar_url )
      )
    `,
    )
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (error || !row) notFound();

  const ident = row.customers?.customer_identities;
  const customerName =
    ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';
  const customerPhone = ident?.phone?.trim() || null;
  const customerEmail = ident?.email?.trim() || '';
  const preferredPaymentMethod =
    row.customers?.tenant_customer_profiles?.preferred_payment_method ?? null;
  const quoteAmountRaw = row.tenant_quotes?.amount_cents;
  const prop = row.tenant_customer_properties;
  const siteLine = prop
    ? [prop.label?.trim(), formatPropertyAddressLine(prop)].filter(Boolean).join(' — ')
    : '';
  const assignees = normalizeAssigneeRows(
    row.tenant_scheduled_visit_assignees as Parameters<typeof normalizeAssigneeRows>[0],
  );
  const assigneeUserIds = assignees.map((a) => a.userId);

  if (isFieldEmployee && !isVisitAssignee(assigneeUserIds, actorUserId)) {
    redirect('/schedule?employee=me&access=visit');
  }

  const relatedRecords = await getVisitRelatedRecords(supabase, membership.tenantId, {
    id: row.id,
    customer_id: row.customer_id,
    quote_id: row.quote_id,
    completion_invoice_id: row.completion_invoice_id,
  });

  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const canUseProofPhotos = isFeatureEnabled(tier, 'proofOfServicePhotos');
  const canUseGpsCheckIn = isFeatureEnabled(tier, 'gpsVerifiedCheckIn');
  const proofPhotosSharedWithCustomers = isFeatureEnabled(tier, 'proofOfServicePortalShare');

  const proofPhotos =
    row.status === 'completed' && canUseProofPhotos
      ? await listVisitProofPhotos(admin, visitId)
      : [];

  const durationResolution =
    !isFieldEmployee && row.status === 'scheduled'
      ? await resolveVisitDurationForVisit(admin, membership.tenantId, visitId)
      : null;
  const durationHours = durationResolution?.durationHours ?? DEFAULT_VISIT_DURATION_HOURS;
  const durationSourceLabel =
    durationResolution?.sourceLabel ??
    (row.visit_purpose === 'consultation'
      ? 'Consultation default'
      : `Default (${DEFAULT_VISIT_DURATION_HOURS} hr)`);

  let employeeOptions: { id: string; label: string }[] = [];
  if (!isFieldEmployee) {
    const membersRes = await supabase
      .from('tenant_memberships')
      .select('user_id, role')
      .eq('tenant_id', membership.tenantId)
      .eq('is_active', true)
      .order('role', { ascending: true });

    const memberUserIds = [...new Set((membersRes.data ?? []).map((m) => m.user_id))];
    const { data: memberProfiles } =
      memberUserIds.length > 0
        ? await supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .in('user_id', memberUserIds)
        : { data: [] as { user_id: string; display_name: string | null }[] };

    const displayByUserId = new Map((memberProfiles ?? []).map((p) => [p.user_id, p.display_name]));
    employeeOptions = (membersRes.data ?? []).map((m) => ({
      id: m.user_id,
      label: `${displayByUserId.get(m.user_id)?.trim() || 'Member'} (${m.role})`,
    }));
  }

  return (
    <>
      <header className={styles.visitPageHeader}>
        <Link
          href={fromIssues ? SCHEDULE_ISSUES_TAB_HREF : '/schedule'}
          className={styles.backLink}
        >
          ← {fromIssues ? 'Issues' : 'Schedule'}
        </Link>
        <div className={styles.visitPageTitles}>
          <h1 className={styles.visitPageTitle}>{customerName}</h1>
          <p className={styles.visitPageSubtitle}>
            {row.visit_purpose === 'consultation'
              ? 'Consultation visit'
              : row.title || 'Cleaning visit'}
          </p>
        </div>
      </header>

      <VisitDetailCard
        employeeOptions={employeeOptions}
        relatedRecords={!isFieldEmployee ? relatedRecords : null}
        initial={{
          visitId,
          tenantSlug: membership.tenantSlug,
          tenantTimezone,
          title:
            row.title || (row.visit_purpose === 'consultation' ? 'Consultation' : 'Cleaning visit'),
          visitPurpose: row.visit_purpose ?? 'service',
          customerName,
          customerPhone,
          customerEmail,
          siteLine,
          preferredPaymentMethod,
          quoteTitle: row.tenant_quotes?.title ?? null,
          quoteId: row.quote_id,
          quoteAmountCents: quoteAmountRaw ?? null,
          notes: row.notes,
          assignees,
          assigneeUserIds,
          actorUserId,
          actorRole,
          isFieldEmployee,
          canUseProofPhotos,
          canUseGpsCheckIn,
          proofPhotosSharedWithCustomers,
          proofPhotos,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          durationHours,
          durationSourceLabel,
          status: row.status,
          expectedAmountCents: row.expected_amount_cents,
          checkedInAt: row.checked_in_at,
          checkInLat: row.check_in_lat,
          checkInLng: row.check_in_lng,
          checkInAccuracyM: row.check_in_accuracy_m,
          checkInLocationStatus: row.check_in_location_status,
          completedAt: row.completed_at,
          completionPaymentCollected: row.completion_payment_collected,
          completionCollectedMethod: row.completion_collected_method,
          completionCollectedAmountCents: row.completion_collected_amount_cents,
          completionCheckNumber: row.completion_check_number,
          completionInvoiceId: row.completion_invoice_id,
        }}
      />
    </>
  );
}

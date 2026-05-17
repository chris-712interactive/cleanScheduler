'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { parseBrowserDatetimeLocalToIso } from '@/lib/datetime/parseBrowserDatetimeLocal';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CustomerRescheduleFormState {
  error?: string;
  success?: boolean;
}

export async function submitCustomerVisitRescheduleRequest(
  _prev: CustomerRescheduleFormState,
  formData: FormData,
): Promise<CustomerRescheduleFormState> {
  const auth = await requirePortalAccess('customer', '/visits/reschedule');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx?.customerIds.length) {
    redirect('/access-denied?reason=no_customer_profile');
  }

  const visitId = String(formData.get('visit_id') ?? '').trim();
  const customerNote = String(formData.get('customer_note') ?? '').trim();
  const preferredStartRaw = String(formData.get('preferred_starts_at') ?? '').trim();
  const preferredEndRaw = String(formData.get('preferred_ends_at') ?? '').trim();
  const tzOffsetRaw = String(formData.get('client_timezone_offset') ?? '').trim();
  const tzOffset = Number(tzOffsetRaw);

  if (!UUID_RE.test(visitId)) {
    return { error: 'Invalid visit.' };
  }

  if (!customerNote && !preferredStartRaw) {
    return { error: 'Add a message or a preferred start time (or both).' };
  }

  if (!Number.isFinite(tzOffset)) {
    return { error: 'Missing timezone context. Reload the page and try again.' };
  }

  const admin = createAdminClient();

  const { data: visit, error: vErr } = await admin
    .from('tenant_scheduled_visits')
    .select('id, tenant_id, customer_id, starts_at, ends_at, status, checked_in_at')
    .eq('id', visitId)
    .maybeSingle();

  if (vErr || !visit) {
    return { error: 'Visit not found.' };
  }

  if (!ctx.customerIds.includes(visit.customer_id)) {
    return { error: 'This visit is not on your account.' };
  }

  if (visit.status !== 'scheduled') {
    return { error: 'Only scheduled visits can be rescheduled.' };
  }

  if (visit.checked_in_at) {
    return {
      error:
        'This visit has already been checked in — contact your provider to change the time.',
    };
  }

  const now = Date.now();
  if (new Date(visit.starts_at).getTime() < now) {
    return { error: 'This appointment is in the past.' };
  }

  const { data: existingPending } = await admin
    .from('visit_reschedule_requests')
    .select('id')
    .eq('visit_id', visitId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingPending) {
    return {
      error:
        'You already have a pending reschedule request for this visit. Your provider will respond soon.',
    };
  }

  let preferredStartsAt: string | null = null;
  let preferredEndsAt: string | null = null;

  if (preferredStartRaw) {
    const prefStart = parseBrowserDatetimeLocalToIso(preferredStartRaw, tzOffset);
    if (!prefStart) {
      return { error: 'Invalid preferred start time.' };
    }
    preferredStartsAt = prefStart;

    const durationMs = Math.max(
      0,
      new Date(visit.ends_at).getTime() - new Date(visit.starts_at).getTime(),
    );

    if (preferredEndRaw) {
      const prefEnd = parseBrowserDatetimeLocalToIso(preferredEndRaw, tzOffset);
      if (!prefEnd) {
        return { error: 'Invalid preferred end time.' };
      }
      if (new Date(prefEnd) <= new Date(prefStart)) {
        return { error: 'Preferred end must be after preferred start.' };
      }
      preferredEndsAt = prefEnd;
    } else if (durationMs > 0) {
      preferredEndsAt = new Date(new Date(prefStart).getTime() + durationMs).toISOString();
    }
  }

  const { error: insErr } = await admin.from('visit_reschedule_requests').insert({
    tenant_id: visit.tenant_id,
    customer_id: visit.customer_id,
    visit_id: visitId,
    status: 'pending',
    customer_note: customerNote,
    preferred_starts_at: preferredStartsAt,
    preferred_ends_at: preferredEndsAt,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return { error: 'A pending reschedule request already exists for this visit.' };
    }
    return { error: insErr.message ?? 'Could not submit request.' };
  }

  revalidatePath('/visits');
  revalidatePath('/');
  revalidatePath('/visits/reschedule');
  revalidatePath('/', 'layout');
  redirect(`/visits?reschedule=sent`);
}

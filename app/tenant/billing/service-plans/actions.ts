'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Database } from '@/lib/supabase/database.types';

type Interval = Database['public']['Enums']['service_plan_billing_interval'];

function parseAmountCents(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/[$,]/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function parseInterval(raw: string): Interval | null {
  if (raw === 'week' || raw === 'month' || raw === 'year') return raw;
  return null;
}

function parseCadence(raw: string): Database['public']['Enums']['service_plan_cadence'] | null {
  if (raw === 'weekly' || raw === 'biweekly' || raw === 'monthly') return raw;
  return null;
}

function parseIncludedCleans(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function createServicePlanAction(formData: FormData): Promise<void> {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/service-plans');
  const name = String(formData.get('name') ?? '').trim();
  const amountCents = parseAmountCents(String(formData.get('amount_dollars') ?? ''));
  const interval = parseInterval(String(formData.get('billing_interval') ?? ''));
  const cadence = parseCadence(String(formData.get('service_cadence') ?? ''));
  const includedCleans = parseIncludedCleans(String(formData.get('included_cleans') ?? ''));
  const overageRaw = String(formData.get('overage_dollars') ?? '').trim();
  const overageCents = overageRaw ? parseAmountCents(overageRaw) : null;
  if (!name || !amountCents || !interval || !cadence || !includedCleans) {
    redirect('/billing/service-plans?error=invalid');
  }

  const supabase = createTenantPortalDbClient();
  const { error } = await supabase.from('service_plans').insert({
    tenant_id: membership.tenantId,
    name,
    amount_cents: amountCents,
    billing_interval: interval,
    service_cadence: cadence,
    included_cleans: includedCleans,
    overage_amount_cents: overageCents,
  });
  if (error) {
    redirect(`/billing/service-plans?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/billing/service-plans');
  redirect('/billing/service-plans?created=1');
}

export async function deactivateServicePlanAction(formData: FormData): Promise<void> {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/service-plans');
  const planId = String(formData.get('plan_id') ?? '').trim();
  if (!planId) redirect('/billing/service-plans?error=missing_plan');

  const supabase = createTenantPortalDbClient();
  const { error } = await supabase
    .from('service_plans')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('tenant_id', membership.tenantId);

  if (error) {
    redirect(`/billing/service-plans?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/billing/service-plans');
  redirect('/billing/service-plans');
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  TENANT_ADMIN_SUSPENDED_AUDIT,
  TENANT_CONNECT_FROZEN_AUDIT,
} from '@/lib/admin/tenantRiskControls';
import { CONNECT_VELOCITY_BLOCKED_AUDIT_ACTION } from '@/lib/billing/connectPaymentVelocity';

type Admin = SupabaseClient<Database>;

export type FraudAlertKind = 'velocity_blocked' | 'dispute' | 'access_suspended' | 'connect_frozen';

export type FraudAlert = {
  id: string;
  kind: FraudAlertKind;
  createdAt: string;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  title: string;
  detail: string;
  href: string | null;
};

const ALERT_AUDIT_ACTIONS = [
  CONNECT_VELOCITY_BLOCKED_AUDIT_ACTION,
  TENANT_ADMIN_SUSPENDED_AUDIT,
  TENANT_CONNECT_FROZEN_AUDIT,
] as const;

export async function loadAdminFraudAlerts(
  admin: Admin,
  options?: { limit?: number },
): Promise<FraudAlert[]> {
  const limit = options?.limit ?? 100;
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: auditRows }, { data: disputes }, { data: tenants }] = await Promise.all([
    admin
      .from('audit_log_entries')
      .select('id, action, target_tenant_id, payload, created_at')
      .in('action', [...ALERT_AUDIT_ACTIONS])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit),
    admin
      .from('tenant_stripe_disputes')
      .select('id, tenant_id, stripe_dispute_id, amount_cents, status, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit),
    admin.from('tenants').select('id, slug, name'),
  ]);

  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));
  const alerts: FraudAlert[] = [];

  for (const row of auditRows ?? []) {
    const tenant = row.target_tenant_id ? tenantById.get(row.target_tenant_id) : null;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const reason =
      typeof payload.reason === 'string' && payload.reason.trim() ? payload.reason.trim() : null;

    if (row.action === CONNECT_VELOCITY_BLOCKED_AUDIT_ACTION) {
      const reasonLabel =
        typeof payload.reason === 'string' ? payload.reason : 'tenant/customer cap';
      alerts.push({
        id: `audit:${row.id}`,
        kind: 'velocity_blocked',
        createdAt: row.created_at,
        tenantId: row.target_tenant_id,
        tenantSlug: tenant?.slug ?? null,
        tenantName: tenant?.name ?? null,
        title: 'Connect velocity limit hit',
        detail: reason ?? `Blocked: ${reasonLabel}`,
        href: tenant?.slug ? `/tenants/${tenant.slug}` : null,
      });
    } else if (row.action === TENANT_ADMIN_SUSPENDED_AUDIT) {
      alerts.push({
        id: `audit:${row.id}`,
        kind: 'access_suspended',
        createdAt: row.created_at,
        tenantId: row.target_tenant_id,
        tenantSlug: tenant?.slug ?? null,
        tenantName: tenant?.name ?? null,
        title: 'Portal access suspended',
        detail: reason ?? 'Suspended by platform admin',
        href: tenant?.slug ? `/tenants/${tenant.slug}` : null,
      });
    } else if (row.action === TENANT_CONNECT_FROZEN_AUDIT) {
      alerts.push({
        id: `audit:${row.id}`,
        kind: 'connect_frozen',
        createdAt: row.created_at,
        tenantId: row.target_tenant_id,
        tenantSlug: tenant?.slug ?? null,
        tenantName: tenant?.name ?? null,
        title: 'Connect charges frozen',
        detail: reason ?? 'Frozen by platform admin',
        href: tenant?.slug ? `/tenants/${tenant.slug}` : null,
      });
    }
  }

  for (const dispute of disputes ?? []) {
    const tenant = tenantById.get(dispute.tenant_id);
    alerts.push({
      id: `dispute:${dispute.id}`,
      kind: 'dispute',
      createdAt: dispute.created_at,
      tenantId: dispute.tenant_id,
      tenantSlug: tenant?.slug ?? null,
      tenantName: tenant?.name ?? null,
      title: 'Stripe Connect dispute',
      detail: `${dispute.status} · ${dispute.amount_cents}¢ · ${dispute.stripe_dispute_id}`,
      href: tenant?.slug ? `/tenants/${tenant.slug}` : null,
    });
  }

  alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return alerts.slice(0, limit);
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { formatUsdFromCents } from '@/lib/format/money';

type Admin = SupabaseClient<Database>;

type IdentityEmbed = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};

export type ReferralAttributionAuditRow = {
  id: string;
  status: Database['public']['Enums']['referral_attribution_status'];
  attributionSource: Database['public']['Enums']['referral_attribution_source'];
  attributedAt: string;
  qualifiedAt: string | null;
  expiresAt: string;
  referrerCustomerId: string;
  referrerName: string;
  refereeCustomerId: string;
  refereeName: string;
  referralCode: string | null;
};

export type ReferralRewardAuditRow = {
  id: string;
  recipient: Database['public']['Enums']['referral_reward_recipient'];
  customerId: string;
  customerName: string;
  amountLabel: string;
  createdAt: string;
  attributionId: string;
};

export type TenantReferralAuditSnapshot = {
  attributions: ReferralAttributionAuditRow[];
  rewardEvents: ReferralRewardAuditRow[];
};

const AUDIT_LIMIT = 100;

async function customerNameMap(
  admin: Admin,
  tenantId: string,
  customerIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(customerIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await admin
    .from('customers')
    .select('id, customer_identities ( email, first_name, last_name, full_name )')
    .eq('tenant_id', tenantId)
    .in('id', unique);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const identity = row.customer_identities as IdentityEmbed | null;
    map.set(row.id, identity ? formatCustomerDisplayName(identity) : 'Customer');
  }

  return map;
}

export async function loadTenantReferralAudit(
  admin: Admin,
  tenantId: string,
): Promise<TenantReferralAuditSnapshot> {
  const { data: attributionRows, error: attrError } = await admin
    .from('referral_attributions')
    .select(
      `
      id,
      status,
      attribution_source,
      attributed_at,
      qualified_at,
      expires_at,
      referrer_customer_id,
      referee_customer_id,
      referral_code_id
    `,
    )
    .eq('tenant_id', tenantId)
    .order('attributed_at', { ascending: false })
    .limit(AUDIT_LIMIT);

  if (attrError) throw new Error(attrError.message);

  const codeIds = [...new Set((attributionRows ?? []).map((row) => row.referral_code_id))];
  const codeMap = new Map<string, string>();
  if (codeIds.length > 0) {
    const { data: codes, error: codeError } = await admin
      .from('customer_referral_codes')
      .select('id, code')
      .in('id', codeIds);
    if (codeError) throw new Error(codeError.message);
    for (const code of codes ?? []) {
      codeMap.set(code.id, code.code);
    }
  }

  const customerIds: string[] = [];
  for (const row of attributionRows ?? []) {
    customerIds.push(row.referrer_customer_id, row.referee_customer_id);
  }

  const { data: rewardRows, error: rewardError } = await admin
    .from('referral_reward_events')
    .select('id, attribution_id, recipient, customer_id, amount_applied_cents, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(AUDIT_LIMIT);

  if (rewardError) throw new Error(rewardError.message);

  for (const row of rewardRows ?? []) {
    customerIds.push(row.customer_id);
  }

  const names = await customerNameMap(admin, tenantId, customerIds);

  const attributions: ReferralAttributionAuditRow[] = (attributionRows ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    attributionSource: row.attribution_source,
    attributedAt: row.attributed_at,
    qualifiedAt: row.qualified_at,
    expiresAt: row.expires_at,
    referrerCustomerId: row.referrer_customer_id,
    referrerName: names.get(row.referrer_customer_id) ?? 'Customer',
    refereeCustomerId: row.referee_customer_id,
    refereeName: names.get(row.referee_customer_id) ?? 'Customer',
    referralCode: codeMap.get(row.referral_code_id) ?? null,
  }));

  const rewardEvents: ReferralRewardAuditRow[] = (rewardRows ?? []).map((row) => ({
    id: row.id,
    recipient: row.recipient,
    customerId: row.customer_id,
    customerName: names.get(row.customer_id) ?? 'Customer',
    amountLabel: formatUsdFromCents(row.amount_applied_cents),
    createdAt: row.created_at,
    attributionId: row.attribution_id,
  }));

  return { attributions, rewardEvents };
}

export function referralAttributionCsvRows(snapshot: TenantReferralAuditSnapshot): string[][] {
  const header = [
    'Status',
    'Source',
    'Referrer',
    'Referee',
    'Code',
    'Attributed',
    'Qualified',
    'Expires',
  ];

  const rows = snapshot.attributions.map((row) => [
    row.status,
    row.attributionSource,
    row.referrerName,
    row.refereeName,
    row.referralCode ?? '',
    row.attributedAt,
    row.qualifiedAt ?? '',
    row.expiresAt,
  ]);

  return [header, ...rows];
}

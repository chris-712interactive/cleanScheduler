import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import {
  INBOUND_ALERT_WATCH_CURSOR,
  inboundAlertBody,
  inboundAlertTitle,
  type InboundSupportAlert,
  type SupportAlertPortal,
} from '@/lib/messaging/inboundSupportAlert';

export type InboundAlertScope =
  { portal: 'tenant'; tenantId: string } | { portal: 'customer'; customerIds: string[] };

export type InboundSupportAlertPayload = {
  cursor: string | null;
  alert: InboundSupportAlert | null;
  /** True when the lookup failed. Callers must keep their previous cursor. */
  unavailable?: boolean;
};

const INBOUND_SELECT = `
  id,
  body,
  created_at,
  thread_id,
  customer_support_threads!inner (
    subject,
    tenant_id,
    customer_id,
    tenants ( name ),
    customers (
      customer_identities ( first_name, last_name, full_name )
    )
  )
`;

type IdentityName = {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};

type InboundRow = {
  id: string;
  body: string;
  created_at: string;
  thread_id: string;
  customer_support_threads: {
    subject: string;
    tenant_id: string;
    customer_id: string;
    tenants: { name: string } | { name: string }[] | null;
    customers: {
      customer_identities: IdentityName | IdentityName[] | null;
    } | null;
  } | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function counterpartName(portal: SupportAlertPortal, row: InboundRow): string {
  const thread = row.customer_support_threads;
  if (portal === 'customer') {
    return one(thread?.tenants)?.name?.trim() || 'Your provider';
  }
  const identity = one(one(thread?.customers)?.customer_identities);
  if (!identity || !customerHasAnyNameParts(identity)) return 'A customer';
  const name = formatCustomerDisplayName(identity);
  return name === 'Unnamed' ? 'A customer' : name;
}

function toAlert(portal: SupportAlertPortal, row: InboundRow): InboundSupportAlert {
  const subject = row.customer_support_threads?.subject?.trim() || 'Message';
  return {
    id: row.id,
    threadId: row.thread_id,
    title: inboundAlertTitle(counterpartName(portal, row)),
    bodyPreview: inboundAlertBody(subject, row.body),
    createdAt: row.created_at,
  };
}

type ScopedQuery = {
  eq: (column: string, value: string | boolean) => ScopedQuery;
  in: (column: string, values: string[]) => ScopedQuery;
  gt: (column: string, value: string) => ScopedQuery;
  order: (column: string, options: { ascending: boolean }) => ScopedQuery;
  limit: (count: number) => ScopedQuery;
  maybeSingle: () => PromiseLike<{ data: InboundRow | null; error: { message: string } | null }>;
};

async function fetchLatest(
  db: SupabaseClient<Database>,
  scope: InboundAlertScope,
  after: string | null,
): Promise<{ row: InboundRow | null; failed: boolean }> {
  let query = db
    .from('customer_support_messages')
    .select(INBOUND_SELECT)
    .eq('is_from_customer', scope.portal === 'tenant') as unknown as ScopedQuery;

  if (scope.portal === 'tenant') {
    query = query.eq('customer_support_threads.tenant_id', scope.tenantId);
  } else {
    query = query.in('customer_support_threads.customer_id', scope.customerIds);
  }

  if (after) query = query.gt('created_at', after);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[inboundSupportAlert] query failed:', error.message);
    return { row: null, failed: true };
  }
  return { row: data, failed: false };
}

/**
 * Bootstrap (`after === null`) returns the newest inbound timestamp and no alert,
 * so opening the portal does not announce messages already on screen.
 * A later poll passes that timestamp and returns only a newer inbound message.
 */
export async function loadInboundSupportAlert(
  db: SupabaseClient<Database>,
  scope: InboundAlertScope,
  after: string | null,
): Promise<InboundSupportAlertPayload> {
  if (scope.portal === 'customer' && scope.customerIds.length === 0) {
    return { cursor: null, alert: null };
  }

  const result = await fetchLatest(db, scope, after);
  if (result.failed) return { cursor: null, alert: null, unavailable: true };

  const row = result.row;
  if (after === null) {
    return { cursor: row?.created_at ?? null, alert: null };
  }

  if (!row) {
    return { cursor: after === INBOUND_ALERT_WATCH_CURSOR ? null : after, alert: null };
  }

  return { cursor: row.created_at, alert: toAlert(scope.portal, row) };
}

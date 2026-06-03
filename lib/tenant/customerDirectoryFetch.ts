import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  buildCustomerDirectorySearchOrFilter,
  customerDirectoryStatusFromQuery,
  customerIdentitySearchOrClause,
  customerPropertySearchOrClause,
  type CustomerDirectoryStatusParam,
} from '@/lib/tenant/customerDirectorySearch';
import {
  CUSTOMER_DIRECTORY_PAGE_SIZE,
  customerDirectoryRange,
} from '@/lib/tenant/customerDirectoryPaging';

type Admin = SupabaseClient<Database>;

export type CustomerDirectoryListRow = {
  id: string;
  status: string;
  customer_identities: {
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    phone: string | null;
  } | null;
  tenant_customer_properties:
    | {
        address_line1: string | null;
        address_line2: string | null;
        city: string | null;
        state: string | null;
        postal_code: string | null;
        is_primary: boolean;
      }[]
    | null;
};

const CUSTOMER_SELECT = `
  id,
  status,
  customer_identities (
    email,
    first_name,
    last_name,
    full_name,
    phone
  ),
  tenant_customer_properties (
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    is_primary
  )
`;

export type CustomerDirectoryFetchResult =
  | {
      ok: true;
      rows: CustomerDirectoryListRow[];
      totalCount: number;
      statusCounts: { all: number; active: number; inactive: number };
      page: number;
    }
  | { ok: false; phase: 'search' | 'list' | 'counts'; message: string };

async function resolveSearchOrFilter(
  admin: Admin,
  tenantId: string,
  q: string,
): Promise<{ searchOrFilter: string | null; error: string | null }> {
  const statusFromQuery = customerDirectoryStatusFromQuery(q);

  const [identResult, propertyResult, statusResult] = await Promise.all([
    admin.from('customer_identities').select('id').or(customerIdentitySearchOrClause(q)),
    admin
      .from('tenant_customer_properties')
      .select('customer_id')
      .eq('tenant_id', tenantId)
      .or(customerPropertySearchOrClause(q)),
    statusFromQuery
      ? admin.from('customers').select('id').eq('tenant_id', tenantId).eq('status', statusFromQuery)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const searchError = identResult.error ?? propertyResult.error ?? statusResult.error ?? null;
  if (searchError) {
    return { searchOrFilter: null, error: searchError.message };
  }

  const identityIds = identResult.data?.map((row) => row.id) ?? [];
  const customerIds = [
    ...new Set([
      ...(propertyResult.data?.map((row) => row.customer_id) ?? []),
      ...(statusResult.data?.map((row) => row.id) ?? []),
    ]),
  ];

  return {
    searchOrFilter: buildCustomerDirectorySearchOrFilter({ identityIds, customerIds }),
    error: null,
  };
}

function buildFilteredCustomerQuery(
  admin: Admin,
  params: {
    tenantId: string;
    statusFilter: CustomerDirectoryStatusParam;
    searchOrFilter: string | null;
  },
) {
  let query = admin.from('customers').select(CUSTOMER_SELECT, { count: 'exact' });
  query = query.eq('tenant_id', params.tenantId);
  if (params.statusFilter !== 'all') {
    query = query.eq('status', params.statusFilter);
  }
  if (params.searchOrFilter) {
    query = query.or(params.searchOrFilter);
  }
  return query;
}

export async function fetchCustomerDirectoryStatusCounts(
  admin: Admin,
  tenantId: string,
): Promise<{ all: number; active: number; inactive: number } | null> {
  const [allRes, activeRes, inactiveRes] = await Promise.all([
    admin.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'inactive'),
  ]);

  if (allRes.error || activeRes.error || inactiveRes.error) {
    return null;
  }

  return {
    all: allRes.count ?? 0,
    active: activeRes.count ?? 0,
    inactive: inactiveRes.count ?? 0,
  };
}

export async function fetchCustomerDirectoryPage(
  admin: Admin,
  params: {
    tenantId: string;
    q: string;
    statusFilter: CustomerDirectoryStatusParam;
    page: number;
  },
): Promise<CustomerDirectoryFetchResult> {
  let searchOrFilter: string | null = null;

  if (params.q.length > 0) {
    const search = await resolveSearchOrFilter(admin, params.tenantId, params.q);
    if (search.error) {
      return { ok: false, phase: 'search', message: search.error };
    }
    searchOrFilter = search.searchOrFilter;
    if (searchOrFilter === null) {
      const statusCounts = await fetchCustomerDirectoryStatusCounts(admin, params.tenantId);
      return {
        ok: true,
        rows: [],
        totalCount: 0,
        statusCounts: statusCounts ?? { all: 0, active: 0, inactive: 0 },
        page: 1,
      };
    }
  }

  const safePage = Math.max(1, params.page);

  const runListQuery = async (page: number) => {
    const range = customerDirectoryRange(page);
    return buildFilteredCustomerQuery(admin, {
      tenantId: params.tenantId,
      statusFilter: params.statusFilter,
      searchOrFilter,
    })
      .order('created_at', { ascending: false })
      .range(range.from, range.to)
      .overrideTypes<CustomerDirectoryListRow[], { merge: false }>();
  };

  let listResult = await runListQuery(safePage);

  if (listResult.error) {
    return { ok: false, phase: 'list', message: listResult.error.message };
  }

  const totalCount = listResult.count ?? listResult.data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / CUSTOMER_DIRECTORY_PAGE_SIZE));
  const clampedPage = Math.min(safePage, totalPages);

  if (clampedPage !== safePage && totalCount > 0) {
    listResult = await runListQuery(clampedPage);
    if (listResult.error) {
      return { ok: false, phase: 'list', message: listResult.error.message };
    }
  }

  const statusCounts = await fetchCustomerDirectoryStatusCounts(admin, params.tenantId);

  return {
    ok: true,
    rows: listResult.data ?? [],
    totalCount,
    statusCounts: statusCounts ?? { all: 0, active: 0, inactive: 0 },
    page: clampedPage,
  };
}

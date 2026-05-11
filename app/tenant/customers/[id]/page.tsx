import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { CustomerDetailEmbedRow } from '@/lib/tenant/customerEmbedTypes';
import { CustomerEditForm } from '../CustomerEditForm';
import styles from '../customers.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantCustomerDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = rawId.trim();
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/customers/${id}`);

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from('customers')
    .select(
      `
      id,
      status,
      created_at,
      customer_identities (
        id,
        email,
        full_name,
        phone
      )
    `,
    )
    .eq('id', id)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle()
    .overrideTypes<CustomerDetailEmbedRow, { merge: false }>();

  if (error || !row) {
    notFound();
  }

  const customer = row;
  const identity = customer.customer_identities;
  if (!identity) {
    notFound();
  }

  const displayName = identity.full_name ?? 'Unnamed';
  const email = identity.email ?? '';
  const phone = identity.phone ?? '';

  return (
    <>
      <PageHeader
        title={displayName}
        description="Customer profile for this workspace."
        actions={
          <Link href="/customers" className={styles.backLink}>
            ← All customers
          </Link>
        }
      />

      <Stack gap={6}>
        <Card title="Summary" description="Read-only metadata from your directory.">
          <KeyValueList
            items={[
              { key: 'Customer ID', value: customer.id },
              { key: 'Status', value: customer.status },
              { key: 'Added', value: new Date(customer.created_at).toLocaleString() },
            ]}
          />
        </Card>

        <Card title="Edit customer" description="Updates this workspace’s view of the customer.">
          <CustomerEditForm
            tenantSlug={membership.tenantSlug}
            snapshot={{
              customerId: customer.id,
              fullName: identity.full_name ?? '',
              email,
              phone,
              status: customer.status,
            }}
          />
        </Card>
      </Stack>
    </>
  );
}

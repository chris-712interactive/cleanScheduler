import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { normalizePaymentMethodsFromDb } from '@/lib/tenant/operationalSettings';
import { OperationalSettingsForm } from './OperationalSettingsForm';
import styles from './settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings');

  const supabase = createTenantPortalDbClient();
  const { data: opsRow } = await supabase
    .from('tenant_operational_settings')
    .select('accepted_quote_schedule_mode, invoice_expectation, allowed_customer_payment_methods')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  const opsSnapshot = opsRow
    ? {
        accepted_quote_schedule_mode: opsRow.accepted_quote_schedule_mode,
        invoice_expectation: opsRow.invoice_expectation,
        allowed_customer_payment_methods: normalizePaymentMethodsFromDb(opsRow.allowed_customer_payment_methods),
      }
    : {
        accepted_quote_schedule_mode: 'prompt_staff' as const,
        invoice_expectation: 'pay_after_service' as const,
        allowed_customer_payment_methods: normalizePaymentMethodsFromDb(undefined),
      };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Personal preferences and workspace details. Deeper billing and Connect setup stay under Billing."
      />

      <Stack gap={6}>
        <Card title="Appearance" description="Light, dark, or match your system.">
          <div className={styles.themeRow}>
            <span className={styles.label}>Theme</span>
            <ThemeToggle />
          </div>
        </Card>

        <Card title="Workspace" description="Read-only snapshot from your tenant record.">
          <KeyValueList
            items={[
              { key: 'Name', value: membership.tenantName },
              { key: 'Slug', value: membership.tenantSlug },
              { key: 'Your role', value: membership.role },
            ]}
          />
        </Card>

        <Card
          title="Quotes, scheduling & customer payments"
          description="Defaults for how your team works after a quote is accepted, how you usually invoice, and which payment methods customers may choose. (Enforcement in customer flows comes in a follow-up.)"
        >
          <OperationalSettingsForm tenantSlug={membership.tenantSlug} snapshot={opsSnapshot} />
        </Card>
      </Stack>
    </>
  );
}

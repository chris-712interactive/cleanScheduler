import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { formatVisitWhenRange } from '@/lib/datetime/formatInTimeZone';
import { createAdminClient } from '@/lib/supabase/server';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { PROPERTY_KIND_LABEL, type CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import {
  loadConsultationVisitsForProperties,
  propertyConsultationPhase,
} from '@/lib/tenant/propertyConsultationRequest';
import { redirect } from 'next/navigation';
import { RequestPropertyForm } from './RequestPropertyForm';
import styles from './properties.module.scss';

export const dynamic = 'force-dynamic';

function requestStatus(
  phase: ReturnType<typeof propertyConsultationPhase>,
  startsAt: string | null,
  endsAt: string | null,
  timeZone: string,
): string | null {
  if (phase === 'needs_scheduling') return 'Waiting for a consultation at this address.';
  if (phase === 'scheduled' && startsAt && endsAt) {
    return `Consultation scheduled for ${formatVisitWhenRange(startsAt, endsAt, timeZone)}.`;
  }
  if (phase === 'scheduled') return 'Consultation scheduled.';
  return null;
}

export default async function CustomerPropertiesPage() {
  const auth = await requirePortalAccess('customer', '/properties');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const admin = createAdminClient();
  const { data: properties } =
    ctx.customerIds.length > 0
      ? await admin
          .from('tenant_customer_properties')
          .select(
            `
            id,
            tenant_id,
            customer_id,
            label,
            property_kind,
            address_line1,
            address_line2,
            city,
            state,
            postal_code,
            site_notes,
            is_primary,
            consultation_requested_at,
            tenants ( timezone )
          `,
          )
          .in('customer_id', ctx.customerIds)
          .order('is_primary', { ascending: false })
      : { data: [] };

  const rows = properties ?? [];
  const visitsByTenant = new Map<
    string,
    Awaited<ReturnType<typeof loadConsultationVisitsForProperties>>
  >();
  const tenantIds = [...new Set(rows.map((row) => row.tenant_id))];
  await Promise.all(
    tenantIds.map(async (tenantId) => {
      const propertyIds = rows
        .filter((row) => row.tenant_id === tenantId && row.consultation_requested_at)
        .map((row) => row.id);
      visitsByTenant.set(
        tenantId,
        await loadConsultationVisitsForProperties(admin, tenantId, propertyIds),
      );
    }),
  );

  return (
    <>
      <PageHeader
        title="Properties"
        description="Locations on your account. You can look them up here, and ask to add another."
      />
      <Stack gap={6}>
        {ctx.links.length === 0 ? (
          <Card title="Your locations">
            <p className={styles.muted}>Your account is not linked to a cleaning company yet.</p>
          </Card>
        ) : (
          ctx.links.map((link) => {
            const locations = rows.filter((row) => row.customer_id === link.customerId);
            const visits = visitsByTenant.get(link.tenantId) ?? [];
            return (
              <Card
                key={link.linkId}
                title={ctx.links.length > 1 ? link.tenantName : 'Your locations'}
                description="These addresses stay read-only. Ask your cleaner if one needs a correction."
              >
                {locations.length === 0 ? (
                  <p className={styles.muted}>No locations on file yet.</p>
                ) : (
                  <ul className={styles.list}>
                    {locations.map((location) => {
                      const propertyVisits = visits.filter(
                        (visit) => visit.propertyId === location.id,
                      );
                      const phase = propertyConsultationPhase(
                        location.consultation_requested_at,
                        propertyVisits.map((visit) => visit.status),
                      );
                      const next =
                        propertyVisits.find((visit) => visit.status === 'scheduled') ?? null;
                      const timezone =
                        (location.tenants as { timezone: string } | null)?.timezone ??
                        'America/New_York';
                      const status = requestStatus(
                        phase,
                        next?.startsAt ?? null,
                        next?.endsAt ?? null,
                        timezone,
                      );
                      const address = formatPropertyAddressLine(location);
                      return (
                        <li key={location.id} className={styles.location}>
                          <div className={styles.locationTitle}>
                            <span>{location.label?.trim() || address || 'Location'}</span>
                            {location.is_primary ? (
                              <span className={styles.primary}>Primary</span>
                            ) : null}
                          </div>
                          <p className={styles.meta}>
                            {PROPERTY_KIND_LABEL[location.property_kind as CustomerPropertyKind]}
                            {address ? ` · ${address}` : ''}
                          </p>
                          {location.site_notes?.trim() ? (
                            <p className={styles.note}>{location.site_notes.trim()}</p>
                          ) : null}
                          {status ? <p className={styles.status}>{status}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <RequestPropertyForm tenantId={link.tenantId} customerId={link.customerId} />
              </Card>
            );
          })
        )}
      </Stack>
    </>
  );
}

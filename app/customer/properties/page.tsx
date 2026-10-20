import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { FeedbackToasts } from '@/components/ui/FeedbackToast';
import { PageHeader } from '@/components/portal/PageHeader';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { organizePropertyDetails, type PropertyFact } from '@/lib/customer/organizePropertyDetails';
import { formatVisitWhenRange } from '@/lib/datetime/formatInTimeZone';
import { createAdminClient } from '@/lib/supabase/server';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { PROPERTY_KIND_LABEL, type CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import {
  loadConsultationVisitsForProperties,
  propertyConsultationPhase,
} from '@/lib/tenant/propertyConsultationRequest';
import styles from './properties.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function placeLine(city: string | null, state: string | null, postal: string | null): string {
  const region = [state, postal].filter(Boolean).join(' ');
  return [city, region].filter(Boolean).join(', ');
}

function FactList({ facts, wide = false }: { facts: PropertyFact[]; wide?: boolean }) {
  if (facts.length === 0) return null;
  return (
    <dl className={wide ? styles.factStack : styles.factGrid}>
      {facts.map((fact) => (
        <div key={fact.label} className={styles.fact}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.detailBlock}>
      <h3 className={styles.detailTitle}>{title}</h3>
      {children}
    </section>
  );
}

export default async function CustomerPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = firstParam((await searchParams).requested) === '1';
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
            community_name,
            building_name,
            bedrooms,
            bathrooms,
            sqft,
            stories,
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
  await Promise.all(
    [...new Set(rows.map((row) => row.tenant_id))].map(async (tenantId) => {
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
        description="Open a location for the address and what your cleaner already knows about it."
        actions={
          ctx.links.length > 0 ? (
            <Button as={Link} href="/properties/new" variant="primary">
              Request another location
            </Button>
          ) : null
        }
      />
      <FeedbackToasts
        messages={[
          requested
            ? {
                title: 'Request sent. Your cleaner will schedule a consultation.',
                variant: 'success' as const,
              }
            : null,
        ]}
      />

      {ctx.links.length === 0 ? (
        <p className={styles.muted}>Your account is not linked to a cleaning company yet.</p>
      ) : (
        ctx.links.map((link) => {
          const locations = rows.filter((row) => row.customer_id === link.customerId);
          const visits = visitsByTenant.get(link.tenantId) ?? [];
          return (
            <section key={link.linkId} className={styles.company}>
              {ctx.links.length > 1 ? (
                <h2 className={styles.companyName}>{link.tenantName}</h2>
              ) : null}
              {locations.length === 0 ? (
                <p className={styles.muted}>No locations on file yet.</p>
              ) : (
                <div className={styles.list}>
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
                    const street = location.address_line1?.trim() || '';
                    const named = location.label?.trim() || '';
                    const title =
                      named && named.toLowerCase() !== street.toLowerCase()
                        ? named
                        : street || named || 'Location';
                    const place = placeLine(location.city, location.state, location.postal_code);
                    const kind =
                      PROPERTY_KIND_LABEL[location.property_kind as CustomerPropertyKind];
                    const details = organizePropertyDetails({
                      siteNotes: location.site_notes,
                      bedrooms: location.bedrooms,
                      bathrooms: location.bathrooms,
                      sqft: location.sqft,
                      stories: location.stories,
                    });
                    const status =
                      phase === 'needs_scheduling'
                        ? 'Waiting for a consultation at this address.'
                        : phase === 'scheduled' && next
                          ? `Consultation scheduled for ${formatVisitWhenRange(next.startsAt, next.endsAt, timezone)}.`
                          : phase === 'scheduled'
                            ? 'Consultation scheduled.'
                            : null;
                    const address = formatPropertyAddressLine(location);

                    return (
                      <details key={location.id} className={styles.card}>
                        <summary className={styles.summary}>
                          <span className={styles.title}>
                            {title}
                            {location.is_primary ? (
                              <span className={styles.primary}>Primary</span>
                            ) : null}
                            {phase === 'needs_scheduling' ? (
                              <span className={styles.pending}>Consultation pending</span>
                            ) : null}
                            {phase === 'scheduled' ? (
                              <span className={styles.pending}>Consultation scheduled</span>
                            ) : null}
                          </span>
                          <span className={styles.meta}>
                            {kind}
                            {place ? ` · ${place}` : ''}
                          </span>
                        </summary>
                        <div className={styles.body}>
                          {status ? <p className={styles.status}>{status}</p> : null}
                          <DetailBlock title="Address">
                            <p className={styles.address}>{address || 'No address on file'}</p>
                            {location.community_name?.trim() || location.building_name?.trim() ? (
                              <p className={styles.addressExtra}>
                                {[location.community_name, location.building_name]
                                  .map((part) => part?.trim())
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            ) : null}
                          </DetailBlock>
                          {details.home.length > 0 ? (
                            <DetailBlock title="The home">
                              <FactList facts={details.home} />
                            </DetailBlock>
                          ) : null}
                          {details.service.length > 0 ? (
                            <DetailBlock title="Service">
                              <FactList facts={details.service} />
                            </DetailBlock>
                          ) : null}
                          {details.included.length > 0 ? (
                            <DetailBlock title="What's included">
                              <FactList facts={details.included} wide />
                            </DetailBlock>
                          ) : null}
                          {details.household.length > 0 ? (
                            <DetailBlock title="Household">
                              <FactList facts={details.household} />
                            </DetailBlock>
                          ) : null}
                          {details.access.length > 0 || details.notes ? (
                            <DetailBlock title="Notes">
                              {details.access.length > 0 ? (
                                <FactList facts={details.access} wide />
                              ) : null}
                              {details.notes ? (
                                <p className={styles.notes}>{details.notes}</p>
                              ) : null}
                            </DetailBlock>
                          ) : null}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}
    </>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { activeHiringGates } from '@/lib/hiring/questions';
import { interviewKindLabel } from '@/lib/hiring/notify';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { ApplyForm } from './ApplyForm';
import styles from '../apply.module.scss';

export const dynamic = 'force-dynamic';

const NOINDEX: Metadata = {
  robots: { index: false, follow: false },
  title: 'Apply',
};

export async function generateMetadata(): Promise<Metadata> {
  return NOINDEX;
}

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: openingSlug } = await params;
  const { kind, tenantSlug } = await getPortalContext();
  if ((kind !== 'site' && kind !== 'tenant') || !tenantSlug) notFound();

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, slug, logo_url')
    .eq('slug', tenantSlug)
    .maybeSingle();
  if (!tenant) notFound();

  const plan = await resolveTenantEntitlementPlan(admin, tenant.id);
  if (!isFeatureEnabled(plan, 'hiringDesk')) {
    return (
      <main className={styles.page}>
        <p className={styles.unavailable}>This application is not available.</p>
      </main>
    );
  }

  const { data: opening } = await admin
    .from('tenant_hiring_openings')
    .select(
      'slug, title, status, pay_text, schedule_text, area_text, interview_kind, require_transportation, require_accepts_pay, require_accepts_schedule, require_background_check_willing, require_work_authorized',
    )
    .eq('tenant_id', tenant.id)
    .eq('slug', openingSlug)
    .maybeSingle();

  if (!opening || opening.status !== 'open') {
    return (
      <main className={styles.page}>
        <p className={styles.unavailable}>This application is not available.</p>
      </main>
    );
  }

  const businessName = tenant.name?.trim() || tenant.slug;

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.brand}>{businessName}</h1>
        <p className={styles.kicker}>{opening.title}</p>
        <dl className={styles.facts}>
          <div>
            <dt>Pay</dt>
            <dd>{opening.pay_text}</dd>
          </div>
          <div>
            <dt>Days</dt>
            <dd>{opening.schedule_text}</dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd>{opening.area_text}</dd>
          </div>
          <div>
            <dt>Next step</dt>
            <dd>{interviewKindLabel(opening.interview_kind)}</dd>
          </div>
        </dl>
        <p className={styles.lead}>
          {businessName} is the employer. Answer the questions and, if you pass, confirm the time
          they email you. This does not create an account.
        </p>
        <ApplyForm
          tenantSlug={tenant.slug}
          openingSlug={opening.slug}
          gates={activeHiringGates(opening)}
        />
      </div>
    </main>
  );
}

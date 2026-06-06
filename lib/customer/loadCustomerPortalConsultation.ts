import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { resolveCustomerConsultationStatus } from '@/lib/tenant/customerConsultation';

type Admin = SupabaseClient<Database>;

export type CustomerPortalConsultationView = {
  status: 'not_required' | 'needs_scheduling' | 'scheduled';
  nextConsultation: {
    id: string;
    startsAt: string;
    endsAt: string;
    siteLine: string | null;
  } | null;
  tenantTimezone: string;
};

export async function loadCustomerPortalConsultationView(
  admin: Admin,
  tenantId: string,
  customerId: string,
): Promise<CustomerPortalConsultationView | null> {
  const resolved = await resolveCustomerConsultationStatus(admin, tenantId, customerId);
  if (resolved.status === 'not_required' || resolved.status === 'completed') {
    return null;
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('timezone')
    .eq('id', tenantId)
    .maybeSingle();

  let siteLine: string | null = null;
  if (resolved.nextConsultation) {
    const { data: visit } = await admin
      .from('tenant_scheduled_visits')
      .select(
        `
        tenant_customer_properties (
          address_line1,
          address_line2,
          city,
          state,
          postal_code
        )
      `,
      )
      .eq('id', resolved.nextConsultation.id)
      .maybeSingle();

    const property = visit?.tenant_customer_properties as {
      address_line1: string | null;
      address_line2: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
    } | null;

    if (property) {
      siteLine = [
        property.address_line1,
        property.address_line2,
        property.city,
        property.state,
        property.postal_code,
      ]
        .filter(Boolean)
        .join(', ');
    }
  }

  return {
    status: resolved.status,
    tenantTimezone: tenant?.timezone ?? 'America/New_York',
    nextConsultation: resolved.nextConsultation
      ? {
          id: resolved.nextConsultation.id,
          startsAt: resolved.nextConsultation.startsAt,
          endsAt: resolved.nextConsultation.endsAt,
          siteLine,
        }
      : null,
  };
}

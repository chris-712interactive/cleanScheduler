'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { StatusPill } from '@/components/ui/StatusPill';
import { updateWebsiteLeadStatusAction, type WebsiteActionState } from './actions';
import styles from './website-settings.module.scss';

type LeadItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  message: string | null;
  status: string;
  createdAt: string;
};

export function WebsiteLeadsPanel({
  tenantSlug,
  leads,
}: {
  tenantSlug: string;
  leads: LeadItem[];
}) {
  const [state, formAction, pending] = useActionState<WebsiteActionState, FormData>(
    updateWebsiteLeadStatusAction,
    {},
  );
  useFeedbackToast({ error: state.error, success: state.success, pending });

  if (leads.length === 0) {
    return (
      <section className={styles.settingsSection}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Leads</h2>
          <p className={styles.sectionLead}>Contact form submissions from your public website.</p>
        </header>
        <p className={styles.sectionLead}>No leads yet.</p>
      </section>
    );
  }

  return (
    <section className={styles.settingsSection}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Leads</h2>
        <p className={styles.sectionLead}>Contact form submissions from your public website.</p>
      </header>

      <table className={styles.leadsTable}>
        <thead>
          <tr>
            <th scope="col">Contact</th>
            <th scope="col">Message</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>
                <strong>{lead.name}</strong>
                <br />
                {lead.email}
                {lead.phone ? (
                  <>
                    <br />
                    {lead.phone}
                  </>
                ) : null}
                {lead.city ? (
                  <>
                    <br />
                    {lead.city}
                  </>
                ) : null}
              </td>
              <td>{lead.message ?? '—'}</td>
              <td>
                <StatusPill
                  tone={
                    lead.status === 'new'
                      ? 'warning'
                      : lead.status === 'contacted'
                        ? 'neutral'
                        : 'success'
                  }
                >
                  {lead.status}
                </StatusPill>
              </td>
              <td>
                {lead.status === 'new' ? (
                  <form action={formAction}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="lead_id" value={lead.id} />
                    <input type="hidden" name="status" value="contacted" />
                    <Button type="submit" size="sm" disabled={pending}>
                      Mark contacted
                    </Button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

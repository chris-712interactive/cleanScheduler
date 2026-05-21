/**
 * Retention periods by data category. Update when product behavior or legal
 * requirements change. Rendered on /data-retention.
 */

export type RetentionDisposition = 'delete' | 'anonymize' | 'archive' | 'provider-controlled';

export type RetentionScheduleRow = {
  category: string;
  examples: string;
  /** How long we retain the data under normal operations. */
  retentionPeriod: string;
  /** What happens when the period ends or on account closure. */
  disposition: RetentionDisposition;
  notes?: string;
};

export const PLATFORM_RETENTION_SCHEDULE: RetentionScheduleRow[] = [
  {
    category: 'Workspace and tenant configuration',
    examples:
      'Company profile, slug, branding, operational settings, compensation rules, service plans',
    retentionPeriod:
      'While the workspace is active; 30 days after free trial ends if never subscribed; up to 90 days after voluntary owner closure on activated workspaces',
    disposition: 'delete',
    notes:
      'Never-activated trial workspaces are hard-deleted automatically 30 days after trial_ends_at (see lib/billing/tenantPurge.ts). Voluntary owner deletion allows time to export data and complete billing wind-down. Hard delete cascades to tenant-scoped tables where database constraints are configured with ON DELETE CASCADE.',
  },
  {
    category: 'Tenant user accounts (staff and owners)',
    examples: 'Profiles, memberships, roles, employee avatars',
    retentionPeriod:
      'While the user remains a member of a workspace; auth records until account deletion is confirmed',
    disposition: 'delete',
    notes:
      'Removing a user from a workspace does not always delete the underlying Supabase Auth user if they belong to other workspaces. Full auth deletion requires an explicit account deletion request.',
  },
  {
    category: 'Customer and operations records',
    examples:
      'Customers, properties, schedules, visits, quotes, line items, invoices, payments, support threads',
    retentionPeriod: 'While the tenant workspace is active',
    disposition: 'delete',
    notes:
      'Deleted when the tenant workspace is deleted, subject to legal hold or billing record exceptions below.',
  },
  {
    category: 'Platform billing and Stripe mirrors',
    examples:
      'tenant_billing_accounts, subscription status, Connect account metadata, mirrored charges, refunds, disputes, payouts',
    retentionPeriod: '7 years after the transaction or tax-relevant period ends',
    disposition: 'archive',
    notes:
      'Supports tax, accounting, and chargeback obligations. Stripe also retains payment data under its own policies.',
  },
  {
    category: 'Generated reports (cache)',
    examples: 'report_runs rows and PDF objects in report_exports storage',
    retentionPeriod: '1 hour from generation (cache TTL)',
    disposition: 'delete',
    notes: 'Automatic expiry via expires_at; PDFs in storage may persist until overwritten or manual cleanup.',
  },
  {
    category: 'Webhook idempotency logs',
    examples: 'stripe_webhook_events, resend_webhook_events',
    retentionPeriod: 'Up to 90 days after successful processing',
    disposition: 'delete',
    notes:
      'Used only to prevent duplicate processing. Failed events may be deleted sooner on retry; operational purge may run periodically.',
  },
  {
    category: 'Email campaigns and suppressions',
    examples:
      'Campaigns, recipients, delivery metrics, tenant_email_suppressions, Resend message metadata we store',
    retentionPeriod: 'While the workspace is active; suppressions until removed by a tenant admin',
    disposition: 'delete',
    notes:
      'Resend retains message logs under its policy independently. Bounced addresses may remain suppressed to honor opt-out.',
  },
  {
    category: 'Transactional email content',
    examples: 'Quote, invoice, trial-ending, dispute, and invite emails sent via Resend',
    retentionPeriod: 'Not stored in full in our database after send',
    disposition: 'provider-controlled',
    notes: 'We retain recipient metadata and status in app tables where applicable; message bodies live with Resend for a limited provider retention window.',
  },
  {
    category: 'Portal and employee invites',
    examples: 'customer_portal_invites, employee_invites',
    retentionPeriod: 'Until accepted, revoked, or 30 days after expires_at (whichever is first)',
    disposition: 'delete',
  },
  {
    category: 'Marketing and sales inquiries',
    examples: 'marketing_inquiries from the public contact form',
    retentionPeriod: '3 years from submission',
    disposition: 'delete',
  },
  {
    category: 'Founder admin audit and masquerade',
    examples: 'audit_log_entries, masquerade_sessions',
    retentionPeriod: '3 years from event timestamp',
    disposition: 'archive',
    notes: 'Supports security investigations and access reviews.',
  },
  {
    category: 'Application and hosting logs',
    examples: 'Vercel request logs, runtime errors, cron execution output',
    retentionPeriod: '30–90 days (per hosting provider configuration)',
    disposition: 'provider-controlled',
  },
  {
    category: 'Database backups',
    examples: 'Supabase point-in-time recovery and daily backups',
    retentionPeriod: 'Per Supabase project backup policy (typically up to 7–30 days rolling)',
    disposition: 'provider-controlled',
    notes:
      'Backups may contain deleted data until backup rotation completes; we do not restore deleted tenant data except for disaster recovery.',
  },
  {
    category: 'Planned: bank reconciliation (Plaid)',
    examples: 'bank_links, imported transactions (when feature is enabled)',
    retentionPeriod: 'While connection is active, plus 90 days after disconnect',
    disposition: 'delete',
    notes: 'Not yet active in production application code; schedule applies when enabled.',
  },
  {
    category: 'Planned: SMS (Twilio)',
    examples: 'Outbound SMS logs and delivery metadata (when feature is enabled)',
    retentionPeriod: 'While workspace is active; message bodies per Twilio retention (typically up to 400 days)',
    disposition: 'provider-controlled',
    notes: 'Not yet active in production application code.',
  },
];

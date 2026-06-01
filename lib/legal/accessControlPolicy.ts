/** Structured sections for the Access Control Policy (ACP). */

import type { PolicySection } from '@/lib/legal/informationSecurityPolicy';

export const ACP_POLICY_OWNER = 'Platform engineering';
export const ACP_REVIEW_CADENCE = 'Quarterly access review; annual policy review';

export const TENANT_ROLE_MATRIX: { role: string; capabilities: string }[] = [
  {
    role: 'Owner',
    capabilities:
      'Full workspace control: billing, team management, settings, bank reconciliation (Plaid), integrations, workspace deletion.',
  },
  {
    role: 'Admin',
    capabilities:
      'Billing, team invites and role changes (except owner), settings, bank reconciliation (Plaid), integrations. Cannot change owner role.',
  },
  {
    role: 'Employee (field)',
    capabilities:
      'Assigned schedule, job completion, limited billing actions (record payments). Restricted route allowlist.',
  },
  {
    role: 'Viewer',
    capabilities: 'Read-only access to workspace data permitted by plan entitlements.',
  },
];

export const PLATFORM_ROLE_MATRIX: { role: string; capabilities: string }[] = [
  {
    role: 'super_admin / admin',
    capabilities:
      'Founder admin portal, tenant support, masquerade into tenant workspaces (logged), audit log access.',
  },
  {
    role: 'customer',
    capabilities: 'Customer portal access scoped to linked service providers.',
  },
];

export const ACCESS_CONTROL_POLICY_SECTIONS: PolicySection[] = [
  {
    id: 'purpose',
    title: '1. Purpose',
    paragraphs: [
      'This Access Control Policy defines how Clean Scheduler grants, modifies, reviews, and revokes access to application features and production systems.',
    ],
  },
  {
    id: 'authentication',
    title: '2. Authentication',
    paragraphs: ['All users authenticate through Supabase Auth:'],
    bullets: [
      'Email and password with optional Google OAuth.',
      'TOTP multi-factor authentication (MFA) required for tenant owner and admin roles before sensitive financial operations (Plaid bank connection).',
      'Platform administrators must enroll MFA for admin portal and infrastructure dashboard access.',
      'Sessions are cookie-bound JWT tokens refreshed by middleware; expired sessions redirect to sign-in.',
    ],
  },
  {
    id: 'authorization',
    title: '3. Authorization model',
    paragraphs: [
      'Authorization combines Postgres row-level security (workspace isolation), JWT application roles, and server-side role checks.',
    ],
    bullets: [
      'Tenant roles (owner, admin, employee, viewer) control in-workspace permissions.',
      'Platform roles (super_admin, admin, customer) control portal access.',
      'Feature entitlements (plan tier) gate premium capabilities such as Plaid reconciliation and API access.',
      'Machine access uses hashed API keys (tenant REST API) or Bearer CRON_SECRET (scheduled jobs).',
    ],
  },
  {
    id: 'provisioning',
    title: '4. Access provisioning',
    paragraphs: ['Access is granted through defined workflows:'],
    bullets: [
      'Tenant owners/admins invite employees via email; invite acceptance creates membership.',
      'Platform admin roles are assigned manually in Supabase Auth app_metadata by policy owner.',
      'Tenant API keys are created by owner/admin in workspace integrations settings; plain key shown once.',
      'Principle of least privilege: assign the minimum role required for job function.',
    ],
  },
  {
    id: 'deprovisioning',
    title: '5. Access modification and deprovisioning',
    paragraphs: ['Access is revoked or modified promptly when roles change or employment ends:'],
    bullets: [
      'Tenant members: owner/admin deactivates membership; sessions are invalidated globally; portal access blocked immediately.',
      'Role changes update membership, JWT claims, and are logged to the platform audit log.',
      'Workforce (company personnel): follow docs/security/workforce-access-runbook.md within 24 hours of departure.',
      'API keys: revoke in integrations settings when personnel with access leave; rotate if compromise suspected.',
    ],
  },
  {
    id: 'privileged',
    title: '6. Privileged access',
    paragraphs: [
      'Privileged access includes platform administrator accounts, Supabase service role keys, Vercel/Stripe/Plaid dashboard access, and support masquerade sessions.',
    ],
    bullets: [
      'Masquerade requires platform admin role, creates masquerade_sessions record, and logs start/end to audit_log_entries.',
      'Masquerade sessions expire after 60 minutes.',
      'Service role keys are used only in trusted server paths after application-level authorization checks.',
    ],
  },
  {
    id: 'review',
    title: '7. Access reviews',
    paragraphs: [
      'Quarterly access reviews verify platform admin roster, open masquerade sessions, production dashboard access, and tenant API key inventory. Procedure: docs/security/access-review-runbook.md.',
    ],
  },
  {
    id: 'matrix',
    title: '8. Role-permission matrix',
    paragraphs: ['Tenant workspace roles:'],
  },
];

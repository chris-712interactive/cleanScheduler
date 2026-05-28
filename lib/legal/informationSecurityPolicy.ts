/** Structured sections for the Information Security Policy (ISP). */

export type PolicySection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const ISP_POLICY_OWNER = 'Platform engineering';
export const ISP_REVIEW_CADENCE = 'Annual, and after material architecture or vendor changes';

export const INFORMATION_SECURITY_POLICY_SECTIONS: PolicySection[] = [
  {
    id: 'scope',
    title: '1. Scope and purpose',
    paragraphs: [
      'This Information Security Policy (ISP) defines how cleanScheduler protects information assets processed through the Service, including tenant workspace data, customer portal data, platform billing records, and workforce access to production systems.',
      'It applies to all personnel with access to cleanScheduler source code, infrastructure dashboards, or production data.',
    ],
  },
  {
    id: 'roles',
    title: '2. Roles and responsibilities',
    paragraphs: ['Security responsibilities are assigned as follows:'],
    bullets: [
      'Policy owner: approves this ISP, access control policy, and major security changes.',
      'Engineering: implements application controls (authentication, authorization, encryption in transit, secure development).',
      'Operations: manages Vercel, Supabase, Stripe, Plaid, and GitHub access; executes incident response and access reviews.',
      'Tenants: responsible for strong passwords, limiting admin access, and customer consent for communications.',
    ],
  },
  {
    id: 'assets',
    title: '3. Information classification',
    paragraphs: ['Data is handled according to sensitivity:'],
    bullets: [
      'Public: marketing content, published pricing, security summaries.',
      'Internal: operational runbooks, non-production configuration.',
      'Confidential: tenant customer records, schedules, invoices, messages.',
      'Restricted: authentication credentials, API keys, Plaid access tokens, Stripe secrets, service role keys.',
    ],
  },
  {
    id: 'encryption',
    title: '4. Encryption and transmission security',
    paragraphs: [
      'All web traffic to cleanScheduler uses HTTPS (TLS). Database and object storage encryption at rest is provided by Supabase. Payment card data is processed by Stripe; cleanScheduler does not store full card numbers.',
      'Plaid bank connection tokens are stored server-side only and are not exposed to browser clients or non-admin tenant roles.',
    ],
  },
  {
    id: 'access',
    title: '5. Access control',
    paragraphs: [
      'Access to the Service and production systems follows the Access Control Policy. Application users authenticate through Supabase Auth. Tenant workspace access is enforced through Postgres row-level security, portal middleware, and role-based server actions.',
      'Privileged platform operations (founder admin, support masquerade) require platform administrator roles and are logged.',
    ],
    bullets: [
      'See Access Control Policy for role definitions and provisioning procedures.',
      'See IAM architecture documentation for identity types (platform, tenant, customer, machine).',
    ],
  },
  {
    id: 'vulnerability',
    title: '6. Vulnerability management',
    paragraphs: [
      'cleanScheduler maintains a vulnerability scanning program integrated into continuous integration:',
    ],
    bullets: [
      'Dependabot opens weekly pull requests for npm and GitHub Actions dependency updates.',
      'CI runs npm audit on production dependencies with high-severity blocking on every push and pull request.',
      'Pull requests are reviewed with GitHub dependency review for newly introduced vulnerable packages.',
      'Findings are remediated per the runtime EOL policy SLAs (high/critical CVEs within 7 days).',
    ],
  },
  {
    id: 'eol',
    title: '7. Software lifecycle and EOL monitoring',
    paragraphs: [
      'Supported runtimes and dependencies are documented in docs/ops/runtime-eol-policy.md. Node.js 22 LTS is the supported application runtime. Quarterly reviews verify Node, Next.js, Supabase Postgres, and critical SDK versions remain within vendor support.',
    ],
  },
  {
    id: 'vendors',
    title: '8. Vendor and subprocessor management',
    paragraphs: [
      'Third-party services that process data on our behalf are listed in the Privacy Policy and Security page. Material subprocessors include Supabase, Stripe, Vercel, Resend, Google (OAuth), Sent (sent.dm), and Plaid (bank reconciliation).',
      'New subprocessors are evaluated for security posture before production use. Tenants are notified through Privacy Policy updates when subprocessors change materially.',
    ],
  },
  {
    id: 'incident',
    title: '9. Incident response',
    paragraphs: [
      'Suspected unauthorized access, data breach, or security vulnerability must be reported immediately to legal@712int.com.',
    ],
    bullets: [
      'Contain: revoke compromised credentials, disable affected accounts, rotate secrets if needed.',
      'Assess: determine scope, affected tenants, and data categories involved.',
      'Notify: inform affected customers and regulators when required by applicable law.',
      'Remediate: deploy fixes, document root cause, and update controls to prevent recurrence.',
    ],
  },
  {
    id: 'backup',
    title: '10. Backup and disaster recovery',
    paragraphs: [
      'Database backups and point-in-time recovery are managed by Supabase per project configuration. Application hosting failover is managed by Vercel. Backup retention periods are described in the Data Retention Policy.',
    ],
  },
  {
    id: 'development',
    title: '11. Secure development',
    paragraphs: [
      'All changes pass CI quality gates (typecheck, lint, migration sanity, dependency audit) before merge to main. Production secrets are stored in Vercel environment variables and are not committed to source control.',
      'Environment separation prevents local and development builds from connecting to production Supabase when SUPABASE_DISALLOW_PROJECT_REF is configured.',
    ],
  },
  {
    id: 'zero-trust',
    title: '12. Zero trust principles',
    paragraphs: [
      'cleanScheduler applies zero trust principles to its SaaS architecture: no implicit trust based on network location, verification of every authenticated request, least-privilege access, and short-lived credentials where supported.',
      'Detailed mapping of controls is documented in the Zero Trust Posture document.',
    ],
  },
  {
    id: 'review',
    title: '13. Policy review',
    paragraphs: [
      'This policy is reviewed annually and after material changes to architecture, subprocessors, or regulatory requirements. The policy owner records the review date on public policy pages.',
    ],
  },
];

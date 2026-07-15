# Guest invoice pay links

When a workspace **does not** have `customerPortal` (Starter), invoice emails use a guest Stripe Checkout link instead of the customer portal.

## Flow

1. `sendTenantInvoiceEmailForInvoice` creates/reuses a row in `tenant_invoice_pay_tokens` (30-day expiry).
2. Email CTA points to `{apex}/pay/{token}`.
3. Customer pays via Connect Checkout (`kind: tenant_invoice_pay`).
4. Webhook marks the token `used_at` when metadata includes `pay_token`.

Business+ with portal keep portal invoice links.

## Migration

`0086_value_everywhere_pack.sql` — `tenant_invoice_pay_tokens`.

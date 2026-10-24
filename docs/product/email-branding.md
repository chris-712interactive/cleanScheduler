# Email branding

Every Resend message uses one HTML shell. The shell follows who the message is from.

## Who the message is from

**The cleaning company** — customer-facing mail. Header uses the workspace logo (or the business name when no logo is saved), brand color, business address, phone, and email from Settings → Business. The inbox display name is the business name. Reply-to is the business email when one is saved. The verified send address stays `RESEND_FROM_EMAIL`.

Covered mail: portal invites, quotes, invoices and receipts, invoice and visit reminders, on-my-way, review requests, reschedule decisions, referral notes to customers, staff replies in Messages, team invites, and marketing campaigns.

**Clean Scheduler** — product mail to owners, office staff, and platform operations. Header uses the product mark and teal `#006D77`, with the Casper business address in the footer. The inbox display name is Clean Scheduler.

Covered mail: trial welcome and trial-ending reminders, time off and hour-change notices, reschedule requests to the office, quote accepted or declined, customer Messages alerts to staff, website leads, referral alerts to the owner, Stripe dispute and velocity alerts, and founder outreach.

Pro workspaces with white-label customer portal omit the “Sent with Clean Scheduler” footer line on company mail. Everyone else keeps that one line so the customer can see which product delivered it.

## Where it lives

| Piece                            | File                                          |
| -------------------------------- | --------------------------------------------- |
| Brand lookup                     | `lib/email/emailBrand.ts`                     |
| HTML shell, button, detail table | `lib/email/transactionalEmailLayout.ts`       |
| Inbox display name               | `lib/email/fromAddress.ts`                    |
| Send                             | `lib/email/resend.ts` (`fromName`, `replyTo`) |

Portal invites are this HTML shell. They no longer use a Resend dashboard template. `RESEND_FROM_EMAIL` is required, same as other mail. `RESEND_CUSTOMER_INVITE_TEMPLATE_ID` is ignored and kept only so older environment files still parse.

Logo files must be `http` or `https` image URLs. The product mark is `https://cleanscheduler.com/favicon/web-app-manifest-192x192.png` (SVG is not reliable in mail clients).

## Notes for later changes

- Do not use `public/brand/logo.svg` in mail. It is very large, and many clients block SVG. `apple-icon.png` has an opaque background. The 192px web-app manifest PNG is transparent.
- The From address stays the verified `RESEND_FROM_EMAIL`. Only the display name changes. `formatEmailFromAddress` strips quotes and angle brackets from that name.
- Customer reply-to is `tenants.business_email` when it is a normal address.
- White-label is the `whiteLabelCustomerPortal` entitlement (Pro, not the trial profile). `loadTenantEmailBrand` sets `showPlatformMark` from that check.
- Portal invites are this HTML shell. `RESEND_CUSTOMER_INVITE_TEMPLATE_ID` is unused on purpose so older environment files still parse.
- A new message should call `wrapTransactionalEmailHtml` with a `brand`, then pass `emailDeliveryFields(brand)` into `sendTransactionalEmail`.

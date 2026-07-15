# Visit checklists

Crew QA checklists on **all plans** (`visitChecklists`).

## How it works

1. **Templates** — Settings → Service types: one checklist per service-type row (one task per line, max 20).
2. **Visit state** — When a visit is opened and its quote line links to a template with items, `tenant_visit_checklist_state` is created.
3. **Field UI** — Visit detail shows checkboxes; progress is visible to office. Completing a visit is **not** blocked if items remain unchecked.
4. **Today** — Field job cards deep-link to check-in / complete via `?action=`.

## Schema

Migration `0086_value_everywhere_pack.sql`:

- `tenant_service_templates.checklist_items` jsonb
- `tenant_visit_checklist_state` (tenant_id + visit_id unique)

## Related

- Guest invoice pay links (Starter / no portal): `docs/product/guest-invoice-pay.md`
- Starter customer emails: `docs/product/starter-customer-emails.md`

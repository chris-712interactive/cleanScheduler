# Visit checklists

Crew QA checklists and consultation walkthrough checklists on **all plans** (`visitChecklists`).

## How it works

1. **Service visit templates** — Settings → Service types: **Visit checklist** per service-type row (one task per line, max 20). Used for cleaning jobs linked via a quote line’s service template.
2. **Consultation templates** — Same Settings page: **Consultation checklist** per service-type row. Used when booking a consultation with that service type.
3. **Visit state** — When a visit is opened and a template with items resolves, `tenant_visit_checklist_state` is created.
4. **Field UI** — Visit detail shows checkboxes; progress is visible to office. Completing a visit is **not** blocked if items remain unchecked.
5. **Consultation notes** — Schedule and complete forms capture notes. On complete, notes are saved on the visit and merged into the property’s `site_notes` (replace if empty, otherwise append a dated consultation block).
6. **Consultation details** — The visit page collects the walkthrough answers used to price a quote (service, frequency, square footage, condition, supplies, scope, and residential or commercial space facts). Every answer is optional unless the company checks it under Settings → Operations → Required consultation answers. Checked answers must be saved before the consultation can be marked complete. A custom cadence still needs a description, and a pet count is still required when the home has pets. Square footage, bedrooms, bathrooms, and stories copy onto the service location when they are filled in. A new quote opened for that customer starts from the saved answers.
7. **Today** — Field job cards deep-link to check-in / complete via `?action=`.

## Schema

Migration `0086_value_everywhere_pack.sql`:

- `tenant_service_templates.checklist_items` jsonb
- `tenant_visit_checklist_state` (tenant_id + visit_id unique)

Migration `0087_consultation_checklist_and_notes.sql`:

- `tenant_service_templates.consultation_checklist_items` jsonb
- `tenant_scheduled_visits.consultation_service_template_id` (FK to service template)

Migration `0098_consultation_intake.sql`:

- `tenant_scheduled_visits.consultation_intake` jsonb

Migration `0099_consultation_required_fields.sql`:

- `tenant_operational_settings.consultation_required_fields` text[] (default empty)

## Related

- Guest invoice pay links (Starter / no portal): `docs/product/guest-invoice-pay.md`
- Starter customer emails: `docs/product/starter-customer-emails.md`

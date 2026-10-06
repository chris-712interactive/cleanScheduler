# Job notes, customer notes, job types, and community name

## Job notes

Office owners and admins set **job notes** when scheduling a visit and when editing a scheduled visit. Assigned field employees see those notes on the day card (a short note under the address) and on the job, grouped with crew notes and location notes under **Notes**. Office-only customer notes are not included. The day card and the job page lead with directions and check-in; notes stay visible without replacing those actions. The field job page does not show the customer email, crew list, billing preference, or quote link.

## Customer notes

| Field        | Stored on                                 | Who sees it                                      |
| ------------ | ----------------------------------------- | ------------------------------------------------ |
| Office notes | `tenant_customer_profiles.internal_notes` | Office, on the customer record                   |
| Crew notes   | `tenant_customer_profiles.field_notes`    | Office and field employees, including on the job |

## Job types

Settings → **Job types** (`/settings/services`) is the catalog used when scheduling a job. Every plan includes the built-in types (durations and checklists are editable). **Pro** can add custom job type names (`customServiceTypes`). Choosing a type on a new appointment fills the job title; the title can still be edited for that visit.

## Community name

`tenant_customer_properties.community_name` (`0095`) is an optional gated-community or neighborhood name. It is shown on the location and on the job. It is not part of the mailing address used for maps.

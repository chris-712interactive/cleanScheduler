-- Gate, door, and garage codes. Ciphertext only. The encryption key is an app secret.

alter table public.tenant_customer_properties
  add column if not exists access_codes_ciphertext text;

comment on column public.tenant_customer_properties.access_codes_ciphertext is
  'AES-256-GCM payload for gate, door, and garage codes. Bound to tenant and property. The key is PROPERTY_ACCESS_CODE_KEY and is not stored in the database. Null means no codes.';

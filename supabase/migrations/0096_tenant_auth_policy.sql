-- Workspace sign-in policy: passkeys instead of passwords, and optional required 2FA.

alter table public.tenant_operational_settings
  add column allow_passkey_sign_in boolean not null default true,
  add column mfa_required boolean not null default false,
  add column mfa_allowed_methods text[] not null default array['totp', 'passkey']::text[];

comment on column public.tenant_operational_settings.allow_passkey_sign_in is
  'When true, members who have registered a passkey may use it instead of a password.';

comment on column public.tenant_operational_settings.mfa_required is
  'When true, workspace access requires a verified method from mfa_allowed_methods.';

comment on column public.tenant_operational_settings.mfa_allowed_methods is
  'Acceptable second factors: totp (authenticator app) and passkey (device biometrics).';

alter table public.tenant_operational_settings
  add constraint tenant_op_settings_mfa_methods_whitelist
    check (
      mfa_allowed_methods <@ array['totp', 'passkey']::text[]
    ),
  add constraint tenant_op_settings_mfa_methods_when_required
    check (
      not mfa_required or cardinality(mfa_allowed_methods) >= 1
    );

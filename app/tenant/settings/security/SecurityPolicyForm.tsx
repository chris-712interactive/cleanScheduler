import { saveTenantAuthPolicyAction } from './actions';
import type { MfaMethod, TenantAuthPolicy } from '@/lib/auth/tenantAuthPolicy';
import { Button } from '@/components/ui/Button';
import styles from './security-settings.module.scss';

const METHOD_COPY: Record<MfaMethod, { title: string; lead: string }> = {
  totp: {
    title: 'Authenticator app',
    lead: 'A 6-digit code from Google Authenticator, 1Password, or a similar app.',
  },
  passkey: {
    title: 'Passkey',
    lead: 'Face ID, fingerprint, or a device PIN. Signing in with a passkey counts as the second step.',
  },
};

export function SecurityPolicyForm({
  tenantSlug,
  policy,
  canEdit,
}: {
  tenantSlug: string;
  policy: TenantAuthPolicy;
  canEdit: boolean;
}) {
  return (
    <form className={styles.form} action={saveTenantAuthPolicyAction}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />

      <label className={styles.choice}>
        <input
          type="checkbox"
          name="allow_passkey_sign_in"
          defaultChecked={policy.allowPasskeySignIn}
          disabled={!canEdit}
        />
        <span>
          <span className={styles.choiceTitle}>Allow passkeys instead of passwords</span>
          <p className={styles.choiceLead}>
            People who add a passkey on their account can sign in with it. Password and Google stay
            available. Turn this off to require a password or Google for this workspace.
          </p>
        </span>
      </label>

      <label className={styles.choice}>
        <input
          type="checkbox"
          name="mfa_required"
          defaultChecked={policy.mfaRequired}
          disabled={!canEdit}
        />
        <span>
          <span className={styles.choiceTitle}>Require two-factor authentication</span>
          <p className={styles.choiceLead}>
            Everyone on this workspace must verify with one of the methods you accept before they
            can open the schedule, customers, or billing.
          </p>
        </span>
      </label>

      <fieldset className={styles.methods} disabled={!canEdit}>
        <legend>Acceptable second steps</legend>
        {(Object.keys(METHOD_COPY) as MfaMethod[]).map((method) => (
          <label key={method} className={styles.choice}>
            <input
              type="checkbox"
              name="mfa_method"
              value={method}
              defaultChecked={policy.mfaAllowedMethods.includes(method)}
            />
            <span>
              <span className={styles.choiceTitle}>{METHOD_COPY[method].title}</span>
              <p className={styles.choiceLead}>{METHOD_COPY[method].lead}</p>
            </span>
          </label>
        ))}
      </fieldset>

      <p className={styles.note}>
        Connecting a bank account still requires an authenticator app for owners and admins, even
        when passkeys are accepted for everyday sign-in.
      </p>

      {canEdit ? <Button type="submit">Save sign-in policy</Button> : null}
    </form>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { addPasskeyOnThisDevice } from '@/lib/auth/passkeyBrowser';
import { deleteMyPasskey, listMyPasskeys } from '@/lib/auth/passkeyCeremony';
import { Button } from '@/components/ui/Button';
import styles from './passkeySettings.module.scss';

type PasskeyRow = {
  id: string;
  friendlyName: string;
  createdAt: string;
};

export function PasskeySettingsPanel({
  workspaceAllowsPasskeys = true,
  countsAsSecondFactor = false,
}: {
  /** When false, this workspace will not accept a passkey session. */
  workspaceAllowsPasskeys?: boolean;
  countsAsSecondFactor?: boolean;
}) {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listMyPasskeys();
    if (result.error) {
      setError(result.error);
      setPasskeys([]);
      setLoading(false);
      return;
    }
    setPasskeys(result.passkeys);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addPasskey = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const message = await addPasskeyOnThisDevice();
    if (message) {
      setError(message);
      setSubmitting(false);
      return;
    }
    setSuccess('Passkey saved. You can use it the next time you sign in.');
    setSubmitting(false);
    await refresh();
  };

  const removePasskey = async (passkeyId: string) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const result = await deleteMyPasskey(passkeyId);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    setSuccess('Passkey removed.');
    setSubmitting(false);
    await refresh();
  };

  const lead = !workspaceAllowsPasskeys
    ? 'You can save a passkey for your account. This workspace still requires a password or Google to sign in.'
    : countsAsSecondFactor
      ? 'A passkey on this phone or computer can replace your password and count as this workspace’s second step. The device will ask for Face ID, a fingerprint, or a PIN.'
      : 'Add a passkey if you want to sign in with Face ID, a fingerprint, or a device PIN instead of typing your password.';

  return (
    <div className={styles.panel}>
      <p className={styles.lead}>{lead}</p>
      {error ? (
        <p className={styles.feedback} data-tone="error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className={styles.feedback} data-tone="success" role="status">
          {success}
        </p>
      ) : null}
      {loading ? (
        <p className={styles.meta}>Checking saved passkeys…</p>
      ) : passkeys.length > 0 ? (
        <ul className={styles.list}>
          {passkeys.map((passkey) => (
            <li key={passkey.id} className={styles.row}>
              <div className={styles.copy}>
                <span className={styles.name}>{passkey.friendlyName}</span>
                <span className={styles.meta}>
                  Added {new Date(passkey.createdAt).toLocaleDateString()}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={submitting}
                onClick={() => void removePasskey(passkey.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.meta}>No passkey on this account yet.</p>
      )}
      <Button type="button" disabled={submitting || loading} onClick={() => void addPasskey()}>
        {submitting ? 'Waiting for device…' : 'Add a passkey'}
      </Button>
    </div>
  );
}

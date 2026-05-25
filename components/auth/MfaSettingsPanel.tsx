'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/Button';
import styles from './mfaSettings.module.scss';

type EnrollState =
  | { phase: 'idle' }
  | { phase: 'enrolling'; factorId: string; qrCode: string; secret: string }
  | { phase: 'enrolled' };

export function MfaSettingsPanel({
  requiredForPlaid = false,
}: {
  requiredForPlaid?: boolean;
}) {
  const [enrollState, setEnrollState] = useState<EnrollState>({ phase: 'idle' });
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setLoading(false);
      return;
    }
    const verified = (data.totp ?? []).find((f) => f.status === 'verified');
    setVerifiedFactorId(verified?.id ?? null);
    if (verified) {
      setEnrollState({ phase: 'enrolled' });
    } else {
      setEnrollState({ phase: 'idle' });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const startEnroll = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const supabase = createClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator app',
    });
    if (enrollError || !data?.id || !data.totp?.qr_code) {
      setError(enrollError?.message ?? 'Could not start MFA enrollment.');
      setSubmitting(false);
      return;
    }
    setEnrollState({
      phase: 'enrolling',
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setSubmitting(false);
  };

  const confirmEnroll = async () => {
    if (enrollState.phase !== 'enrolling') return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollState.factorId,
    });
    if (challengeError || !challenge?.id) {
      setError(challengeError?.message ?? 'Could not start verification.');
      setSubmitting(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollState.factorId,
      challengeId: challenge.id,
      code: verifyCode.trim(),
    });
    if (verifyError) {
      setError(verifyError.message);
      setSubmitting(false);
      return;
    }
    setSuccess('Two-factor authentication is enabled.');
    setVerifyCode('');
    setSubmitting(false);
    await refreshFactors();
  };

  const unenroll = async () => {
    if (!verifiedFactorId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const supabase = createClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verifiedFactorId,
    });
    if (unenrollError) {
      setError(unenrollError.message);
      setSubmitting(false);
      return;
    }
    setSuccess('Two-factor authentication removed.');
    setVerifiedFactorId(null);
    setEnrollState({ phase: 'idle' });
    setSubmitting(false);
  };

  if (loading) {
    return <p className={styles.muted}>Loading MFA status…</p>;
  }

  return (
    <div className={styles.stack}>
      {requiredForPlaid ? (
        <p className={styles.banner} role="status">
          Required before connecting a bank account through Plaid.
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className={styles.success} role="status">
          {success}
        </p>
      ) : null}

      {enrollState.phase === 'enrolled' || verifiedFactorId ? (
        <>
          <p className={styles.muted}>
            Status: <strong>Enabled</strong> — your account uses an authenticator app for
            two-factor authentication.
          </p>
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => void unenroll()}>
            Remove authenticator
          </Button>
        </>
      ) : enrollState.phase === 'enrolling' ? (
        <>
          <p className={styles.muted}>
            Scan this QR code with your authenticator app (Google Authenticator, 1Password, etc.),
            then enter the 6-digit code.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollState.qrCode} alt="TOTP QR code" className={styles.qr} />
          <p className={styles.muted}>
            Manual key: <code>{enrollState.secret}</code>
          </p>
          <label className={styles.label} htmlFor="mfa-verify-code">
            Verification code
          </label>
          <input
            id="mfa-verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            className={styles.input}
          />
          <Button type="button" disabled={submitting || verifyCode.length < 6} onClick={() => void confirmEnroll()}>
            {submitting ? 'Verifying…' : 'Confirm and enable'}
          </Button>
        </>
      ) : (
        <>
          <p className={styles.muted}>
            Add an extra layer of security with a time-based one-time password from an
            authenticator app.
          </p>
          <Button type="button" disabled={submitting} onClick={() => void startEnroll()}>
            {submitting ? 'Starting…' : 'Enable authenticator app'}
          </Button>
        </>
      )}
    </div>
  );
}

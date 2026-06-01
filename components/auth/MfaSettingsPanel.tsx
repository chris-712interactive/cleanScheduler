'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { StatusTone } from '@/components/ui/StatusPill';
import styles from './mfaSettings.module.scss';

type EnrollState =
  | { phase: 'idle' }
  | { phase: 'enrolling'; factorId: string; qrCode: string; secret: string }
  | { phase: 'enrolled' };

type ProtectionStatus = 'loading' | 'protected' | 'not_protected' | 'setup_in_progress';

function protectionMeta(status: ProtectionStatus): {
  tone: StatusTone;
  pillLabel: string;
  title: string;
  lead: string;
} {
  switch (status) {
    case 'protected':
      return {
        tone: 'success',
        pillLabel: 'Protected',
        title: 'Your account is protected',
        lead: 'Sign-in requires a code from your authenticator app in addition to your password.',
      };
    case 'setup_in_progress':
      return {
        tone: 'warning',
        pillLabel: 'Setup in progress',
        title: 'Finish connecting your app',
        lead: 'Scan the QR code below and enter the 6-digit code to turn on two-factor authentication.',
      };
    case 'loading':
      return {
        tone: 'neutral',
        pillLabel: 'Checking…',
        title: 'Two-factor authentication',
        lead: 'Checking your protection status…',
      };
    default:
      return {
        tone: 'warning',
        pillLabel: 'Not protected',
        title: 'Turn on two-factor authentication',
        lead: 'Add a second sign-in step with an authenticator app such as Google Authenticator or 1Password.',
      };
  }
}

export function MfaSettingsPanel({ requiredForPlaid = false }: { requiredForPlaid?: boolean }) {
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
      setEnrollState((current) => (current.phase === 'enrolling' ? current : { phase: 'idle' }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const isProtected = Boolean(verifiedFactorId) || enrollState.phase === 'enrolled';
  const protectionStatus: ProtectionStatus = loading
    ? 'loading'
    : isProtected
      ? 'protected'
      : enrollState.phase === 'enrolling'
        ? 'setup_in_progress'
        : 'not_protected';
  const meta = protectionMeta(protectionStatus);

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
    setSuccess('Two-factor authentication is now on.');
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
    setSuccess('Two-factor authentication is off.');
    setVerifiedFactorId(null);
    setEnrollState({ phase: 'idle' });
    setSubmitting(false);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.statusHero} data-status={protectionStatus}>
        <div className={styles.statusIconWrap} aria-hidden>
          {isProtected ? (
            <ShieldCheck size={28} strokeWidth={1.75} className={styles.statusIconProtected} />
          ) : (
            <ShieldOff size={28} strokeWidth={1.75} className={styles.statusIconUnprotected} />
          )}
        </div>
        <div className={styles.statusCopy}>
          <div className={styles.statusHeadingRow}>
            <h2 className={styles.statusTitle}>{meta.title}</h2>
            <StatusPill tone={meta.tone}>{meta.pillLabel}</StatusPill>
          </div>
          <p className={styles.statusLead}>{meta.lead}</p>
        </div>
      </div>

      {requiredForPlaid && !isProtected ? (
        <p className={styles.requirementNotice} role="status">
          Required before you can connect a bank account for deposit matching.
        </p>
      ) : null}

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

      {isProtected ? (
        <div className={styles.protectedActions}>
          <p className={styles.protectedHint}>Authenticator app connected</p>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => void unenroll()}
          >
            Turn off two-factor authentication
          </Button>
        </div>
      ) : enrollState.phase === 'enrolling' ? (
        <div className={styles.setupCard}>
          <ol className={styles.setupSteps}>
            <li>
              Open Google Authenticator, 1Password, or another authenticator app on your phone.
            </li>
            <li>Scan this QR code, then enter the 6-digit code the app shows you.</li>
          </ol>

          <div className={styles.qrWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrollState.qrCode}
              alt="QR code for authenticator app setup"
              className={styles.qr}
            />
          </div>

          <details className={styles.manualKeyDetails}>
            <summary>Can&apos;t scan the code? Enter a setup key instead</summary>
            <p className={styles.manualKeyValue}>
              <code>{enrollState.secret}</code>
            </p>
          </details>

          <div className={styles.verifyRow}>
            <label className={styles.verifyLabel} htmlFor="mfa-verify-code">
              6-digit code
            </label>
            <div className={styles.verifyControls}>
              <input
                id="mfa-verify-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                className={styles.verifyInput}
                placeholder="000000"
              />
              <Button
                type="button"
                disabled={submitting || verifyCode.length < 6}
                onClick={() => void confirmEnroll()}
              >
                {submitting ? 'Verifying…' : 'Verify & turn on'}
              </Button>
            </div>
          </div>
        </div>
      ) : !loading ? (
        <div className={styles.setupStart}>
          <Button type="button" disabled={submitting} onClick={() => void startEnroll()}>
            {submitting ? 'Starting…' : 'Set up authenticator app'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

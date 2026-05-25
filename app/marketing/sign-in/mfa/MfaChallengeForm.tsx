'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import styles from '../sign-in.module.scss';

export function MfaChallengeForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setSubmitting(false);
      return;
    }

    const factor = (factors.totp ?? []).find((f) => f.status === 'verified');
    if (!factor) {
      setError('No authenticator is enrolled on this account.');
      setSubmitting(false);
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (challengeError || !challenge?.id) {
      setError(challengeError?.message ?? 'Could not start MFA challenge.');
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError(verifyError.message);
      setSubmitting(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  };

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <label className={styles.label} htmlFor="mfa-code">
        Authenticator code
      </label>
      <input
        id="mfa-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={styles.input}
        placeholder="000000"
      />
      <button type="submit" className={styles.submit} disabled={submitting || code.length < 6}>
        {submitting ? 'Verifying…' : 'Verify and continue'}
      </button>
    </form>
  );
}

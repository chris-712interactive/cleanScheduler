'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { passkeyErrorMessage } from '@/lib/auth/passkeyErrorMessage';
import { Button } from '@/components/ui/Button';
import styles from './sign-in.module.scss';

export function PasskeySignInButton({ nextPath }: { nextPath: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: passkeyError } = await supabase.auth.signInWithPasskey();
    if (passkeyError) {
      setError(passkeyErrorMessage(passkeyError));
      setPending(false);
      return;
    }

    const continueUrl = `/auth/continue?next=${encodeURIComponent(nextPath)}`;
    window.location.assign(continueUrl);
  };

  return (
    <div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        fullWidth
        loading={pending}
        onClick={() => void signIn()}
      >
        {pending ? 'Waiting for passkey…' : 'Sign in with a passkey'}
      </Button>
    </div>
  );
}

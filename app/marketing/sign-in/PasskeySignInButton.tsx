'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signInWithDevicePasskey } from '@/lib/auth/passkeyBrowser';
import { Button } from '@/components/ui/Button';
import styles from './sign-in.module.scss';

export function PasskeySignInButton({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setPending(true);
    setError(null);
    const message = await signInWithDevicePasskey();
    if (message) {
      setError(message);
      setPending(false);
      return;
    }

    router.push(`/auth/continue?next=${encodeURIComponent(nextPath)}`);
    router.refresh();
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

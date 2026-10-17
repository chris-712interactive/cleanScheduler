'use client';

import { useState } from 'react';
import { signInWithDevicePasskey } from '@/lib/auth/passkeyBrowser';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';

export function PasskeySignInButton({ nextPath }: { nextPath: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useFeedbackToast({ error, pending });

  const signIn = async () => {
    setPending(true);
    setError(null);
    const message = await signInWithDevicePasskey();
    if (message) {
      setError(message);
      setPending(false);
      return;
    }

    const continueUrl = new URL('/auth/continue', window.location.origin);
    continueUrl.searchParams.set('next', nextPath);
    window.location.assign(continueUrl.href);
  };

  return (
    <div>
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

export function passkeyErrorMessage(error: {
  message: string;
  name?: string;
  code?: string;
}): string {
  const code = error.code ?? '';
  const name = error.name ?? '';
  if (code === 'passkey_disabled') {
    return 'Passkeys are not turned on for this app yet. Sign in with your password.';
  }
  if (
    name === 'NotAllowedError' ||
    name === 'AbortError' ||
    /not allowed|timed out|aborte?d|cancel/i.test(error.message)
  ) {
    return 'Passkey prompt was canceled.';
  }
  if (/does not support WebAuthn/i.test(error.message)) {
    return 'This browser cannot use passkeys. Try Safari or Chrome, or use your password.';
  }
  if (code === 'webauthn_credential_exists') {
    return 'This device already has a passkey for your account.';
  }
  return error.message || 'Passkey sign-in failed.';
}

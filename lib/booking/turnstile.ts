const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileMode(input: {
  siteKey?: string | null;
  secret?: string | null;
}): 'off' | 'misconfigured' | 'on' {
  const siteKey = input.siteKey?.trim() ?? '';
  const secret = input.secret?.trim() ?? '';
  if (!siteKey && !secret) return 'off';
  if (!siteKey || !secret) return 'misconfigured';
  return 'on';
}

export async function verifyTurnstileResponse(input: {
  token: string;
  secret: string;
  remoteIp?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const token = input.token.trim();
  const secret = input.secret.trim();
  if (!token || !secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (input.remoteIp?.trim()) body.set('remoteip', input.remoteIp.trim());
  try {
    const response = await (input.fetchImpl ?? fetch)(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { success?: boolean };
    return payload.success === true;
  } catch {
    return false;
  }
}

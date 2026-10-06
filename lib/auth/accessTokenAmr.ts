type AmrEntry = { method?: unknown };

type AccessTokenPayload = {
  amr?: unknown;
  session_id?: unknown;
};

function decodeAccessTokenPayload(
  accessToken: string | null | undefined,
): AccessTokenPayload | null {
  if (!accessToken) return null;
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AccessTokenPayload;
  } catch {
    return null;
  }
}

/** Reads `amr` method names from a Supabase access token payload. */
export function amrMethodsFromAccessToken(accessToken: string | null | undefined): string[] {
  const json = decodeAccessTokenPayload(accessToken);
  if (!json || !Array.isArray(json.amr)) return [];
  return json.amr.flatMap((entry) => {
    if (typeof entry === 'string' && entry.length > 0) return [entry];
    if (entry && typeof entry === 'object' && typeof (entry as AmrEntry).method === 'string') {
      const method = (entry as AmrEntry).method as string;
      return method.length > 0 ? [method] : [];
    }
    return [];
  });
}

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Supabase session id from the access token, when the claim is a UUID. */
export function sessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  const sessionId = decodeAccessTokenPayload(accessToken)?.session_id;
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return null;
  return sessionId;
}

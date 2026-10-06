type AmrEntry = { method?: unknown };

/** Reads `amr` method names from a Supabase access token payload. */
export function amrMethodsFromAccessToken(accessToken: string | null | undefined): string[] {
  if (!accessToken) return [];
  const payload = accessToken.split('.')[1];
  if (!payload) return [];

  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      amr?: unknown;
    };
    if (!Array.isArray(json.amr)) return [];
    return json.amr.flatMap((entry) => {
      if (typeof entry === 'string' && entry.length > 0) return [entry];
      if (entry && typeof entry === 'object' && typeof (entry as AmrEntry).method === 'string') {
        const method = (entry as AmrEntry).method as string;
        return method.length > 0 ? [method] : [];
      }
      return [];
    });
  } catch {
    return [];
  }
}

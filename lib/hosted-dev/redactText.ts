const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const STRIPE = /\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]+\b/g;
const POSTGRES_URL = /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;

export function redactText(input: string, secrets: readonly string[]): string {
  let output = input;
  const unique = [
    ...new Set(secrets.map((secret) => secret.trim()).filter((secret) => secret.length >= 8)),
  ];
  unique.sort((a, b) => b.length - a.length);
  for (const secret of unique) {
    output = output.split(secret).join('[redacted]');
  }
  return output
    .replace(POSTGRES_URL, '[redacted-database-url]')
    .replace(STRIPE, '[redacted-stripe]')
    .replace(JWT, '[redacted-jwt]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(EMAIL, '[redacted-email]');
}

export function secretsFromEnv(env: Record<string, string | undefined>): string[] {
  return Object.entries(env).flatMap(([name, value]) => {
    if (!value) return [];
    if (!/(SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|ANON)/i.test(name)) return [];
    return [value];
  });
}

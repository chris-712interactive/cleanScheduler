const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const STRIPE = /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+\b/g;
const WEBHOOK = /\bwhsec_[A-Za-z0-9]+\b/g;
const SUPABASE_SECRET = /\bsb_secret_[A-Za-z0-9_-]+\b/g;
const POSTGRES_URL = /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi;
const BEARER = /Bearer\s+[^\s"']+/gi;
const AUTH_NAME_VALUE =
  /("name"\s*:\s*"authorization"\s*,\s*"value"\s*:\s*")((?:\\.|[^"\\])*)(")/gi;
const AUTH_VALUE_NAME =
  /("value"\s*:\s*")((?:\\.|[^"\\])*)("\s*,\s*"name"\s*:\s*"authorization")/gi;
const AUTH_FIELD = /("authorization"\s*:\s*")((?:\\.|[^"\\])*)(")/gi;
const AUTH_PLAIN = /(authorization\s*:\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n]*)/gi;

export function redactText(input: string, secrets: readonly string[]): string {
  let output = input;
  const unique = [
    ...new Set(secrets.map((secret) => secret.trim()).filter((secret) => secret.length > 0)),
  ];
  unique.sort((a, b) => b.length - a.length);
  for (const secret of unique) {
    output = output.split(secret).join('[redacted]');
  }
  return output
    .replace(POSTGRES_URL, '[redacted-database-url]')
    .replace(STRIPE, '[redacted-stripe]')
    .replace(WEBHOOK, '[redacted-webhook]')
    .replace(SUPABASE_SECRET, '[redacted-supabase-secret]')
    .replace(JWT, '[redacted-jwt]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(AUTH_NAME_VALUE, '$1[redacted]$3')
    .replace(AUTH_VALUE_NAME, '$1[redacted]$3')
    .replace(AUTH_FIELD, '$1[redacted]$3')
    .replace(AUTH_PLAIN, '$1[redacted]')
    .replace(EMAIL, '[redacted-email]');
}

export function secretsFromEnv(env: Record<string, string | undefined>): string[] {
  return Object.entries(env).flatMap(([name, value]) => {
    if (!value) return [];
    if (!/(SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|ANON)/i.test(name)) return [];
    return [value];
  });
}

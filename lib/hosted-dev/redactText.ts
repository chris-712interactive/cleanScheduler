const POSTGRES_URL = /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi;
const STRIPE = /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+\b/g;
const WEBHOOK = /\bwhsec_[A-Za-z0-9]+\b/g;
const SUPABASE_SECRET = /\bsb_secret_[A-Za-z0-9_-]+\b/g;
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER = /Bearer\s+[^\s"']+/gi;
const AUTH_NAME_VALUE =
  /("name"\s*:\s*"authorization"\s*,\s*"value"\s*:\s*")((?:\\.|[^"\\])*)(")/gi;
const AUTH_VALUE_NAME =
  /("value"\s*:\s*")((?:\\.|[^"\\])*)("\s*,\s*"name"\s*:\s*"authorization")/gi;
const AUTH_FIELD = /("authorization"\s*:\s*")((?:\\.|[^"\\])*)(")/gi;
const AUTH_PLAIN = /(authorization\s*:\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n]*)/gi;

const DECODE_PASSES = 3;
const MAX_KEY_CHARS = 240;
const IMAGE_TLDS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp']);
const BOUNDARY = new Set(['#', '?', '&', ';', '/', ' ', '\t', '\n', '\r', '"', "'", '<', '>']);
const SENSITIVE_KEYS = new Set([
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'providertoken',
  'providerrefreshtoken',
  'codeverifier',
  'clientsecret',
  'tokenhash',
  'token',
  'code',
  'email',
  'password',
]);

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeBounded(value: string, passes = DECODE_PASSES): string {
  let current = value;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = safeDecode(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function normalizedKey(raw: string): string {
  return decodeBounded(raw).replace(/[_-]/g, '').toLowerCase();
}

function isSensitiveKey(raw: string): boolean {
  const decoded = decodeBounded(raw);
  if (/^sb-[a-z0-9]+-auth-token$/i.test(decoded)) return true;
  return SENSITIVE_KEYS.has(normalizedKey(decoded));
}

function isBoundary(ch: string | undefined): boolean {
  return ch === undefined || BOUNDARY.has(ch);
}

function isLocalChar(ch: string): boolean {
  return (
    (ch >= 'A' && ch <= 'Z') ||
    (ch >= 'a' && ch <= 'z') ||
    (ch >= '0' && ch <= '9') ||
    ch === '.' ||
    ch === '_' ||
    ch === '%' ||
    ch === '+' ||
    ch === '-'
  );
}

function isDomainChar(ch: string): boolean {
  return (
    (ch >= 'A' && ch <= 'Z') ||
    (ch >= 'a' && ch <= 'z') ||
    (ch >= '0' && ch <= '9') ||
    ch === '.' ||
    ch === '-'
  );
}

/** Length of `%40`, `%2540`, … at `at`. Bounded so a long `%25` run stays linear. */
function encodedAtLength(input: string, at: number): number {
  if (input[at] !== '%') return 0;
  let index = at + 1;
  let repeats = 0;
  while (repeats < 6 && input.slice(index, index + 2).toLowerCase() === '25') {
    index += 2;
    repeats += 1;
  }
  if (input.slice(index, index + 2).toLowerCase() !== '40') return 0;
  return index + 2 - at;
}

function readDomain(input: string, start: number): { end: number } | null {
  let index = start;
  while (index < input.length && isDomainChar(input[index] ?? '')) index += 1;
  if (index === start) return null;
  const domain = input.slice(start, index);
  const dot = domain.lastIndexOf('.');
  if (dot <= 0) return null;
  const tld = domain.slice(dot + 1);
  if (!/^[A-Za-z]{2,24}$/.test(tld) || IMAGE_TLDS.has(tld.toLowerCase())) return null;
  if (!/[A-Za-z]/.test(domain.slice(0, dot))) return null;
  return { end: index };
}

function redactEmails(input: string): string {
  let out = '';
  let cursor = 0;
  for (let index = 0; index < input.length; index += 1) {
    const atLength =
      input[index] === '@' ? 1 : input[index] === '%' ? encodedAtLength(input, index) : 0;
    if (atLength === 0) continue;
    let localStart = index;
    while (localStart > 0 && isLocalChar(input[localStart - 1] ?? '')) localStart -= 1;
    if (localStart === index) continue;
    const domain = readDomain(input, index + atLength);
    if (!domain) continue;
    out += input.slice(cursor, localStart);
    out += '[redacted-email]';
    cursor = domain.end;
    index = domain.end - 1;
  }
  out += input.slice(cursor);
  return out;
}

/** A `;token=` in the path stops at `?`. A value already in a query or fragment does not. */
function pathSemicolonAssignment(input: string, keyStart: number): boolean {
  if (keyStart <= 0 || input[keyStart - 1] !== ';') return false;
  for (let index = 0; index < keyStart; index += 1) {
    const ch = input[index];
    if (ch === '?' || ch === '#') return false;
  }
  return true;
}

function endOfValue(input: string, start: number, stopAtQuestion: boolean): number {
  if (start >= input.length) return start;
  const quote = input[start];
  if (quote === '"' || quote === "'") {
    const close = input.indexOf(quote, start + 1);
    return close === -1 ? input.length : close + 1;
  }
  let index = start;
  while (index < input.length) {
    const ch = input[index];
    if (
      ch === '&' ||
      ch === '#' ||
      ch === '<' ||
      ch === '>' ||
      ch === ' ' ||
      ch === '\t' ||
      ch === '\n' ||
      ch === '\r' ||
      ch === '"' ||
      ch === "'"
    ) {
      break;
    }
    if (stopAtQuestion && ch === '?') break;
    index += 1;
  }
  return index;
}

function isHttpStatusValue(rawKey: string, value: string): boolean {
  return normalizedKey(rawKey) === 'code' && /^\d{3}$/.test(value);
}

function matchAssignment(
  input: string,
  start: number,
): { valueStart: number; sensitive: boolean } | null {
  if (start > 0 && !isBoundary(input[start - 1])) return null;
  let index = start;
  while (index < input.length && index - start < MAX_KEY_CHARS) {
    const ch = input[index] ?? '';
    if (ch === '=') {
      return classify(input.slice(start, index), index + 1);
    }
    if (ch === '%') {
      const encoded = input.slice(index, index + 3);
      if (!/^%[0-9A-Fa-f]{2}$/.test(encoded)) return null;
      if (safeDecode(encoded) === '=') return classify(input.slice(start, index), index + 3);
      index += 3;
      continue;
    }
    if (isBoundary(ch)) return null;
    index += 1;
  }
  return null;
}

function classify(
  rawKey: string,
  valueStart: number,
): { valueStart: number; sensitive: boolean } | null {
  const key = decodeBounded(rawKey);
  if (isSensitiveKey(key)) return { valueStart, sensitive: true };
  if (/^[A-Za-z][A-Za-z0-9._~-]{0,60}$/.test(key)) return { valueStart, sensitive: false };
  return null;
}

function scrubAssignments(input: string, depth: number): string {
  if (depth > 3) return input;
  let out = '';
  let index = 0;
  while (index < input.length) {
    const hit = index === 0 || isBoundary(input[index - 1]) ? matchAssignment(input, index) : null;
    if (!hit) {
      out += input[index] ?? '';
      index += 1;
      continue;
    }
    const valueEnd = endOfValue(input, hit.valueStart, pathSemicolonAssignment(input, index));
    const rawValue = input.slice(hit.valueStart, valueEnd);
    const quote = rawValue[0] === '"' || rawValue[0] === "'" ? rawValue[0] : '';
    const inner =
      quote && rawValue.endsWith(quote) && rawValue.length >= 2 ? rawValue.slice(1, -1) : rawValue;
    if (hit.sensitive) {
      const key = input.slice(index, hit.valueStart).replace(/=$/u, '').replace(/%3d$/i, '');
      if (isHttpStatusValue(key, inner)) {
        out += input.slice(index, valueEnd);
        index = valueEnd;
        continue;
      }
      out += input.slice(index, hit.valueStart);
      out += '[redacted]';
      index = valueEnd;
      continue;
    }
    const decoded = decodeBounded(inner);
    const nested = scrubAssignments(decoded, depth + 1);
    if (nested !== decoded) {
      const encoded = rawValue.includes('%') ? encodeURIComponent(nested) : nested;
      out += input.slice(index, hit.valueStart);
      out += quote ? `${quote}${encoded}${quote}` : encoded;
      index = valueEnd;
      continue;
    }
    out += input.slice(index, valueEnd);
    index = valueEnd;
  }
  return out;
}

export function redactText(input: string, secrets: readonly string[]): string {
  let output = input;
  const unique = [
    ...new Set(secrets.map((secret) => secret.trim()).filter((secret) => secret.length > 0)),
  ];
  unique.sort((a, b) => b.length - a.length);
  for (const secret of unique) {
    output = output.split(secret).join('[redacted]');
  }
  output = output
    .replace(POSTGRES_URL, '[redacted-database-url]')
    .replace(STRIPE, '[redacted-stripe]')
    .replace(WEBHOOK, '[redacted-webhook]')
    .replace(SUPABASE_SECRET, '[redacted-supabase-secret]')
    .replace(JWT, '[redacted-jwt]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(AUTH_NAME_VALUE, '$1[redacted]$3')
    .replace(AUTH_VALUE_NAME, '$1[redacted]$3')
    .replace(AUTH_FIELD, '$1[redacted]$3')
    .replace(AUTH_PLAIN, '$1[redacted]');
  return redactPlaintextSecrets(output);
}

function redactStructuredSecrets(input: string): string {
  const pattern =
    /("(?:access_token|refresh_token|id_token|provider_token|provider_refresh_token|code_verifier|client_secret|token_hash|idToken|accessToken|password|token|code|email)"\s*:\s*")((?:\\.|[^"\\])*)(")/gi;
  return input.replace(pattern, (match, prefix: string, value: string, suffix: string) => {
    if (/"code"\s*:\s*"$/i.test(prefix) && /^\d{3}$/.test(value)) return match;
    return `${prefix}[redacted]${suffix}`;
  });
}

/** Redact addresses and credential assignments in a heading or other short plain string. */
export function redactPlaintextSecrets(input: string): string {
  return redactEmails(scrubAssignments(redactStructuredSecrets(input), 0));
}

/** Redact sibling text nodes as one string so `token=` and its value are not split. */
export function redactJoinedText(parts: readonly string[], secrets: readonly string[]): string[] {
  if (parts.length === 0) return [];
  const redacted = redactText(parts.join(''), secrets);
  return [redacted, ...parts.slice(1).map(() => '')];
}

/** Landing URLs logged by hosted-dev checks. Drops addresses and auth query or fragment values. */
export function redactLandingUrl(raw: string): string {
  const scrubbed = redactPlaintextSecrets(raw);
  let url: URL;
  try {
    url = new URL(scrubbed);
  } catch {
    return '[unreadable url]';
  }
  for (const key of [...url.searchParams.keys()]) {
    if (isSensitiveKey(key)) url.searchParams.set(key, '[redacted]');
  }
  return redactPlaintextSecrets(`${url.origin}${url.pathname}${url.search}${url.hash}`);
}

export function secretsFromEnv(env: Record<string, string | undefined>): string[] {
  return Object.entries(env).flatMap(([name, value]) => {
    if (!value) return [];
    if (!/(SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|ANON)/i.test(name)) return [];
    return [value];
  });
}

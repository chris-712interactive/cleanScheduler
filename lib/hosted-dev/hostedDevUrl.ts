/** Public hosted-dev origin. Tests refuse every other host. */
export const HOSTED_DEV_APEX = 'dev.cleanscheduler.com';
export const HOSTED_DEV_ORIGIN = `https://${HOSTED_DEV_APEX}`;

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isAllowedDevHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (host === HOSTED_DEV_APEX) return true;
  const suffix = `.${HOSTED_DEV_APEX}`;
  if (!host.endsWith(suffix)) return false;
  const label = host.slice(0, -suffix.length);
  if (label.length < 1 || label.length > 63 || label.includes('.')) return false;
  return LABEL.test(label);
}

export function assertHttpsDevUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Blocked URL: not a valid URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Blocked URL: https is required.');
  }
  if (url.username || url.password) {
    throw new Error('Blocked URL: credentials in the URL are not allowed.');
  }
  if (url.port && url.port !== '443') {
    throw new Error('Blocked URL: a non-default port is not allowed.');
  }
  if (!isAllowedDevHostname(url.hostname)) {
    throw new Error('Blocked URL: host is outside dev.cleanscheduler.com.');
  }
  return url;
}

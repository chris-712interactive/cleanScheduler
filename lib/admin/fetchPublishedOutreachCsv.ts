const MAX_CSV_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 20_000;

/** Initial paste URL must be a Sheets link on docs.google.com. */
const ALLOWED_SOURCE_HOSTS = new Set(['docs.google.com']);

/**
 * After follow-redirects, Google often serves the CSV from googleusercontent CDN
 * (or spreadsheets.google.com). Still restrict to Google-owned hosts.
 */
export function isAllowedGoogleSheetDownloadHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (host === 'docs.google.com' || host === 'spreadsheets.google.com') return true;
  if (host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com')) return true;
  return false;
}

export type FetchPublishedOutreachCsvResult =
  { ok: true; text: string; resolvedUrl: string } | { ok: false; error: string };

/**
 * Accept published-to-web CSV links and public export links from Google Sheets.
 * Examples:
 * - https://docs.google.com/spreadsheets/d/e/.../pub?output=csv
 * - https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0
 */
export function normalizePublishedGoogleSheetCsvUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Paste a published Google Sheet CSV URL.' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'That does not look like a valid URL.' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'URL must use HTTPS.' };
  }
  if (!ALLOWED_SOURCE_HOSTS.has(url.hostname)) {
    return { ok: false, error: 'Only docs.google.com spreadsheet URLs are allowed.' };
  }

  const path = url.pathname;
  const isPublishedCsv =
    /\/spreadsheets\/d\/e\/[^/]+\/pub$/i.test(path) &&
    (url.searchParams.get('output')?.toLowerCase() === 'csv' ||
      url.searchParams.get('output')?.toLowerCase() === 'tsv');
  const isExportCsv =
    /\/spreadsheets\/d\/[^/]+\/export$/i.test(path) &&
    (url.searchParams.get('format')?.toLowerCase() === 'csv' ||
      url.searchParams.get('output')?.toLowerCase() === 'csv');

  // Common mistake: share link without /pub?output=csv or /export?format=csv
  if (!isPublishedCsv && !isExportCsv) {
    if (/\/spreadsheets\/d\//i.test(path)) {
      return {
        ok: false,
        error:
          'Use File → Share → Publish to web → CSV (or a public /export?format=csv link), not the normal edit URL.',
      };
    }
    return {
      ok: false,
      error: 'URL must be a Google Sheets published CSV (/pub?output=csv) or export CSV link.',
    };
  }

  if (url.searchParams.get('output')?.toLowerCase() === 'tsv') {
    return { ok: false, error: 'TSV publish links are not supported. Publish as CSV.' };
  }

  return { ok: true, url: url.toString() };
}

export async function fetchPublishedOutreachCsv(
  rawUrl: string,
): Promise<FetchPublishedOutreachCsvResult> {
  const normalized = normalizePublishedGoogleSheetCsvUrl(rawUrl);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(normalized.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/csv,text/plain,*/*',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Could not download sheet (HTTP ${response.status}). Confirm it is published to the web as CSV.`,
      };
    }

    const finalUrl = new URL(response.url);
    if (!isAllowedGoogleSheetDownloadHost(finalUrl.hostname)) {
      return {
        ok: false,
        error: `Download redirected to an unexpected host (${finalUrl.hostname}); refusing to continue.`,
      };
    }

    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (contentLength > MAX_CSV_BYTES) {
      return { ok: false, error: 'Published sheet CSV must be under 2 MB.' };
    }

    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_CSV_BYTES) {
      return { ok: false, error: 'Published sheet CSV must be under 2 MB.' };
    }
    if (!text.trim()) {
      return { ok: false, error: 'Published sheet returned an empty file.' };
    }

    // Google often returns an HTML login/interstitial page when the sheet is not public.
    const looksLikeHtml = /^\s*<(!DOCTYPE|html)/i.test(text);
    if (looksLikeHtml) {
      return {
        ok: false,
        error:
          'Got an HTML page instead of CSV. Publish the sheet to the web as CSV (or make the export link public).',
      };
    }

    return { ok: true, text, resolvedUrl: finalUrl.toString() };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Timed out downloading the published sheet.' };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not download the published sheet.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export { MAX_CSV_BYTES as OUTREACH_MAX_CSV_BYTES };

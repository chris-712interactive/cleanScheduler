import { errors, expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { assertHttpsDevUrl, devUrlOnSameHost } from '../../lib/hosted-dev/hostedDevUrl';
import { redactLandingUrl, redactPlaintextSecrets } from '../../lib/hosted-dev/redactText';
import { classifySignInNavigation } from '../../lib/hosted-dev/signInNavigation';

export { redactLandingUrl };

const SIGN_IN_SETTLE_MS = 20_000;

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value) throw new Error(`BLOCKED: ${name} is not set.`);
  return value;
}

export function optionalSegment(name: string, fallback: 'residential' | 'commercial'): string {
  return process.env[name]?.trim() || fallback;
}

/**
 * Level-1 heading that contains an element whose text is exactly `title`.
 * A hint button inside the `h1` does not change that element. "Billing settings"
 * does not contain an element that is exactly "Billing". "No upcoming visits"
 * is not "Upcoming visits".
 */
export function portalHeading(page: Page, title: string) {
  return page.getByRole('heading', { level: 1 }).filter({
    has: page.getByText(title, { exact: true }),
  });
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  const started = new URL(page.url());
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  // The sign-in page is already loaded. domcontentloaded resolves immediately
  // while the password action is still a background request. Navigating away
  // before the URL changes can cancel that request before the session cookie
  // is stored. Wait until the browser leaves the form, stops on MFA, or
  // changes host. A host change is not a stuck sign-in page.
  try {
    await page.waitForURL((url) => classifySignInNavigation(started.hostname, url) !== 'pending', {
      timeout: SIGN_IN_SETTLE_MS,
      waitUntil: 'commit',
    });
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;
    throw new Error(
      `BLOCKED: sign-in did not finish on ${started.hostname}. The sign-in page was still open, so the session cookie was not confirmed.`,
    );
  }
  const landed = new URL(page.url());
  const navigation = classifySignInNavigation(started.hostname, landed);
  if (navigation === 'left-host') {
    throw new Error(
      `FAIL: sign-in left ${started.hostname} and landed on ${redactLandingUrl(page.url())}.`,
    );
  }
  assertHttpsDevUrl(page.url());
  if (navigation === 'mfa') {
    throw new Error(
      'BLOCKED: this QA user stopped on two-factor verification. Use a dedicated dev user without MFA.',
    );
  }
}

/** Open `path` on the host already showing, not on the marketing apex. */
export async function gotoSameHost(page: Page, path: string): Promise<void> {
  const started = new URL(page.url());
  await page.goto(devUrlOnSameHost(page.url(), path));
  let landed: URL;
  try {
    landed = new URL(page.url());
  } catch {
    throw new Error(`BLOCKED: ${path} ended on an unreadable URL.`);
  }
  if (landed.hostname !== started.hostname) {
    throw new Error(
      `FAIL: ${path} left ${started.hostname} and opened ${redactLandingUrl(page.url())}.`,
    );
  }
  assertHttpsDevUrl(page.url());
}

export async function redactedHeadingText(page: Page): Promise<string> {
  const text = await page
    .locator('h1, h2')
    .first()
    .innerText({ timeout: 1_000 })
    .catch(() => '');
  const redacted = redactPlaintextSecrets(text).replace(/\s+/g, ' ').trim();
  return redacted.slice(0, 140) || 'none';
}

export async function expectDevBanner(page: Page): Promise<void> {
  await expect(
    page.getByRole('status').filter({ hasText: 'Development environment — no real charges.' }),
  ).toBeVisible();
}

export async function maskAndCapture(page: Page, info: TestInfo): Promise<void> {
  if (info.status === info.expectedStatus) return;
  await page
    .evaluate(() => {
      document.querySelectorAll('input, textarea').forEach((element) => {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          element.value = '';
        }
      });
      document.querySelectorAll('h1, h2').forEach((element) => {
        element.textContent = '[redacted heading]';
      });
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
      const encodedEmail = /[A-Z0-9._%+-]+%40[A-Z0-9._%+-]{2,}/gi;
      let node = walker.nextNode();
      while (node) {
        if (node.textContent) {
          const next = node.textContent
            .replace(email, '[redacted-email]')
            .replace(encodedEmail, '[redacted-email]');
          if (next !== node.textContent) node.textContent = next;
        }
        node = walker.nextNode();
      }
    })
    .catch(() => undefined);
  const safeTitle = info.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
  await page
    .screenshot({
      path: `hosted-dev-results/masked-${safeTitle}.png`,
      fullPage: false,
    })
    .catch(() => undefined);
}

export async function copySessionCookies(
  from: BrowserContext,
  to: BrowserContext,
  targetHost: string,
): Promise<void> {
  const cookies = await from.cookies();
  if (cookies.length === 0) {
    throw new Error('BLOCKED: sign-in did not store a session cookie.');
  }
  await to.addCookies(
    cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: targetHost,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: true,
      sameSite: cookie.sameSite,
    })),
  );
}

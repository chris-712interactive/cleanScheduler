import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { assertHttpsDevUrl } from '../../lib/hosted-dev/hostedDevUrl';

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value) throw new Error(`BLOCKED: ${name} is not set.`);
  return value;
}

export function optionalSegment(name: string, fallback: 'residential' | 'commercial'): string {
  return process.env[name]?.trim() || fallback;
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForLoadState('domcontentloaded');
  assertHttpsDevUrl(page.url());
  if (page.url().includes('/sign-in/mfa')) {
    throw new Error(
      'BLOCKED: this QA user stopped on two-factor verification. Use a dedicated dev user without MFA.',
    );
  }
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
      const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
      let node = walker.nextNode();
      while (node) {
        if (node.textContent && email.test(node.textContent)) {
          node.textContent = node.textContent.replace(email, '[redacted-email]');
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

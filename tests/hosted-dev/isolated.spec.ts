import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { assertDevDatabaseUrl } from '../../lib/hosted-dev/databaseTarget';
import { decideIdentity } from '../../lib/hosted-dev/deploymentIdentity';
import { assertHttpsDevUrl } from '../../lib/hosted-dev/hostedDevUrl';
import { mutationGate } from '../../lib/hosted-dev/mutationGate';
import {
  assertFixtureMarker,
  assertTenantId,
  assertViewerIsolation,
  quoteProbePath,
} from '../../lib/hosted-dev/rlsAssertions';
import {
  copySessionCookies,
  expectDevBanner,
  maskAndCapture,
  optionalSegment,
  requiredEnv,
  signIn,
} from './support';

const execFileAsync = promisify(execFile);

test.afterEach(async ({ page }, info) => {
  await maskAndCapture(page, info);
});

async function openTenant(page: Page, slug: string, path: string): Promise<void> {
  const url = assertHttpsDevUrl(`https://${slug}.dev.cleanscheduler.com${path}`);
  await page.goto(url.toString());
  assertHttpsDevUrl(page.url());
}

async function readWorkspace(page: Page, slug: string, segment: string): Promise<void> {
  await openTenant(page, slug, '/schedule');
  await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible();
  await expectDevBanner(page);
  await page.goto('/schedule/recurring');
  await expect(page.getByRole('heading', { name: 'Recurring visits' })).toBeVisible();
  await page.goto('/customers');
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await page.goto('/quotes');
  await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible();
  await page.goto('/billing');
  await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible();
  await page.goto('/settings/business');
  await expect(page.getByRole('heading', { name: 'Business settings' })).toBeVisible();
  await expect(page.locator('input[name="service_segment"]:checked')).toHaveValue(segment);
  if (segment === 'residential') {
    await page.goto('/customers');
    await expect(page.getByRole('link', { name: 'Commercial', exact: true })).toHaveCount(0);
  } else if (segment === 'commercial') {
    await page.goto('/customers');
    await expect(page.getByRole('link', { name: 'Residential', exact: true })).toHaveCount(0);
  }
}

test('residential workspace reads stay inside that tenant', async ({ page }) => {
  const slug = requiredEnv('QA_TENANT_RESIDENTIAL_SLUG');
  await openTenant(page, slug, '/sign-in?next=%2Fschedule');
  await signIn(
    page,
    requiredEnv('QA_TENANT_RESIDENTIAL_EMAIL'),
    requiredEnv('QA_TENANT_RESIDENTIAL_PASSWORD'),
  );
  await readWorkspace(page, slug, optionalSegment('QA_TENANT_RESIDENTIAL_SEGMENT', 'residential'));
});

test('commercial workspace reads stay inside that tenant', async ({ page }) => {
  const slug = requiredEnv('QA_TENANT_COMMERCIAL_SLUG');
  await openTenant(page, slug, '/sign-in?next=%2Fschedule');
  await signIn(
    page,
    requiredEnv('QA_TENANT_COMMERCIAL_EMAIL'),
    requiredEnv('QA_TENANT_COMMERCIAL_PASSWORD'),
  );
  await readWorkspace(page, slug, optionalSegment('QA_TENANT_COMMERCIAL_SEGMENT', 'commercial'));
});

test('a residential session does not open the commercial workspace', async ({ browser }) => {
  const residentialSlug = requiredEnv('QA_TENANT_RESIDENTIAL_SLUG');
  const commercialSlug = requiredEnv('QA_TENANT_COMMERCIAL_SLUG');
  const home = await browser.newContext();
  const other = await browser.newContext();
  try {
    const homePage = await home.newPage();
    await openTenant(homePage, residentialSlug, '/sign-in?next=%2Fschedule');
    await signIn(
      homePage,
      requiredEnv('QA_TENANT_RESIDENTIAL_EMAIL'),
      requiredEnv('QA_TENANT_RESIDENTIAL_PASSWORD'),
    );
    await expect(homePage.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible();
    await copySessionCookies(home, other, `${commercialSlug}.dev.cleanscheduler.com`);
    const otherPage = await other.newPage();
    await openTenant(otherPage, commercialSlug, '/customers');
    const denied = otherPage.getByRole('heading', { name: 'No access to this workspace' });
    const customers = otherPage.getByRole('heading', { name: 'Customers', exact: true });
    if (await denied.isVisible().catch(() => false)) return;
    if (await customers.isVisible().catch(() => false)) {
      throw new Error('FAIL: residential session opened the commercial customer list.');
    }
    throw new Error(
      'BLOCKED: the residential session cookie did not authenticate on the commercial host, so membership denial was not observed.',
    );
  } finally {
    await home.close();
    await other.close();
  }
});

test('platform admin can open the tenant list without changing it', async ({ page }) => {
  await page.goto('https://admin.dev.cleanscheduler.com/sign-in?next=%2F');
  await signIn(page, requiredEnv('QA_ADMIN_EMAIL'), requiredEnv('QA_ADMIN_PASSWORD'));
  const founder = page.getByRole('heading', { name: 'Founder dashboard' });
  const sales = page.getByRole('heading', { name: 'Sales dashboard' });
  await expect(founder.or(sales)).toBeVisible();
  await expectDevBanner(page);
  if (await founder.isVisible()) {
    await page.goto('/tenants');
    await expect(page.getByRole('heading', { name: 'Tenants', exact: true })).toBeVisible();
  }
});

test('customer portal reads quotes, visits, and invoices without paying', async ({ page }) => {
  await page.goto('https://my.dev.cleanscheduler.com/sign-in?next=%2F');
  await signIn(page, requiredEnv('QA_CUSTOMER_EMAIL'), requiredEnv('QA_CUSTOMER_PASSWORD'));
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await expectDevBanner(page);
  await page.goto('/quotes');
  await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible();
  await page.goto('/visits');
  await expect(page.getByRole('heading', { name: 'Upcoming visits' })).toBeVisible();
  await page.goto('/invoices');
  await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
  expect(page.url()).not.toContain('stripe.com');
});

test('cross-tenant quote reads honor RLS for the two fixture users', async ({ request }) => {
  const identityResponse = await request.get('/api/health/deployment', { maxRedirects: 0 });
  expect(identityResponse.status()).toBe(200);
  const decision = decideIdentity({
    httpStatus: 200,
    body: await identityResponse.json(),
    expectedSha: process.env.HOSTED_DEV_EXPECT_SHA,
    deniedSupabaseProjectRef: process.env.HOSTED_DEV_DENY_SUPABASE_PROJECT_REF,
  });
  if (decision.status !== 'ok' || !decision.identity.supabaseHost) {
    throw new Error('BLOCKED: deployment identity did not confirm the dev Supabase host.');
  }
  const supabaseUrl = assertDevSupabaseUrl(
    requiredEnv('QA_DEV_SUPABASE_URL'),
    decision.identity.supabaseHost,
  );
  const anonKey = requiredEnv('QA_DEV_SUPABASE_ANON_KEY');
  const tenantA = requiredEnv('QA_RLS_TENANT_A_ID');
  const tenantB = requiredEnv('QA_RLS_TENANT_B_ID');
  const markerA = requiredEnv('QA_RLS_MARKER_A');
  const markerB = requiredEnv('QA_RLS_MARKER_B');
  assertTenantId(tenantA);
  assertTenantId(tenantB);
  assertFixtureMarker(markerA);
  assertFixtureMarker(markerB);

  const tokenA = await passwordToken(
    supabaseUrl,
    anonKey,
    requiredEnv('QA_RLS_USER_A_EMAIL'),
    requiredEnv('QA_RLS_USER_A_PASSWORD'),
  );
  const tokenB = await passwordToken(
    supabaseUrl,
    anonKey,
    requiredEnv('QA_RLS_USER_B_EMAIL'),
    requiredEnv('QA_RLS_USER_B_PASSWORD'),
  );
  const asA = await viewQuotes(supabaseUrl, anonKey, tokenA, markerA, markerB, tenantB);
  const asB = await viewQuotes(supabaseUrl, anonKey, tokenB, markerB, markerA, tenantA);
  const verdictA = assertViewerIsolation({
    viewer: 'A',
    ownRows: asA.own,
    foreignMarkerRows: asA.foreignMarker,
    foreignTenantRows: asA.foreignTenant,
    ownTenantId: tenantA,
    ownMarker: markerA,
  });
  const verdictB = assertViewerIsolation({
    viewer: 'B',
    ownRows: asB.own,
    foreignMarkerRows: asB.foreignMarker,
    foreignTenantRows: asB.foreignTenant,
    ownTenantId: tenantB,
    ownMarker: markerB,
  });
  if (!verdictA.ok)
    throw new Error(`${verdictA.kind === 'blocked' ? 'BLOCKED' : 'FAIL'}: ${verdictA.reason}`);
  if (!verdictB.ok)
    throw new Error(`${verdictB.kind === 'blocked' ? 'BLOCKED' : 'FAIL'}: ${verdictB.reason}`);
});

const databaseUrl = process.env.QA_DEV_DATABASE_URL?.trim();
if (databaseUrl) {
  test('direct SQL RLS matches the dev Supabase project', async ({ request }) => {
    const identityResponse = await request.get('/api/health/deployment', { maxRedirects: 0 });
    const decision = decideIdentity({
      httpStatus: identityResponse.status(),
      body: identityResponse.status() === 200 ? await identityResponse.json() : null,
    });
    if (decision.status !== 'ok') {
      throw new Error('BLOCKED: direct SQL RLS refused because deployment identity is not dev.');
    }
    const verdict = assertDevDatabaseUrl(databaseUrl, decision.identity.supabaseHost);
    if (!verdict.ok) throw new Error(`FAIL: ${verdict.reason}`);
    const markerA = requiredEnv('QA_RLS_MARKER_A');
    const markerB = requiredEnv('QA_RLS_MARKER_B');
    const userA = requiredEnv('QA_RLS_USER_A_ID');
    const userB = requiredEnv('QA_RLS_USER_B_ID');
    const tenantA = requiredEnv('QA_RLS_TENANT_A_ID');
    const tenantB = requiredEnv('QA_RLS_TENANT_B_ID');
    assertFixtureMarker(markerA);
    assertFixtureMarker(markerB);
    assertTenantId(userA);
    assertTenantId(userB);
    assertTenantId(tenantA);
    assertTenantId(tenantB);
    const target = new URL(databaseUrl);
    await execFileAsync(
      'psql',
      [
        '-v',
        'ON_ERROR_STOP=1',
        '-v',
        `user_a=${userA}`,
        '-v',
        `user_b=${userB}`,
        '-v',
        `tenant_a=${tenantA}`,
        '-v',
        `tenant_b=${tenantB}`,
        '-v',
        `marker_a=${markerA}`,
        '-v',
        `marker_b=${markerB}`,
        '-f',
        'supabase/tests/rls/hosted_dev_cross_tenant.sql',
      ],
      {
        timeout: 60_000,
        env: {
          ...process.env,
          PGHOST: target.hostname,
          PGPORT: target.port || '5432',
          PGUSER: decodeURIComponent(target.username),
          PGPASSWORD: decodeURIComponent(target.password),
          PGDATABASE: target.pathname.replace(/^\//, '') || 'postgres',
          PGSSLMODE: target.searchParams.get('sslmode') || 'require',
        },
      },
    );
  });
}

if (process.env.HOSTED_DEV_MUTATIONS === '1') {
  test('mutation and payment coverage is refused', () => {
    const gate = mutationGate();
    throw new Error(`BLOCKED: ${gate.reason}`);
  });
}

function assertDevSupabaseUrl(raw: string, expectedHost: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('BLOCKED: QA_DEV_SUPABASE_URL is not a URL.');
  }
  if (url.protocol !== 'https:' || url.hostname !== expectedHost || url.username || url.password) {
    throw new Error(
      'BLOCKED: QA_DEV_SUPABASE_URL does not match the dev deployment Supabase host.',
    );
  }
  return url.origin;
}

async function passwordToken(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<string> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`BLOCKED: dev auth token request failed with HTTP ${response.status}.`);
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error('BLOCKED: dev auth token response had no access token.');
  }
  return body.access_token;
}

async function viewQuotes(
  supabaseUrl: string,
  anonKey: string,
  token: string,
  ownMarker: string,
  foreignMarker: string,
  foreignTenantId: string,
): Promise<{ own: unknown; foreignMarker: unknown; foreignTenant: unknown }> {
  async function get(path: string): Promise<unknown> {
    const response = await fetch(new URL(path, supabaseUrl), {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error(`BLOCKED: quote probe returned HTTP ${response.status}.`);
    }
    if (!response.ok) {
      throw new Error(`FAIL: quote probe returned HTTP ${response.status}.`);
    }
    return response.json();
  }
  return {
    own: await get(quoteProbePath({ title: ownMarker })),
    foreignMarker: await get(quoteProbePath({ title: foreignMarker })),
    foreignTenant: await get(quoteProbePath({ tenantId: foreignTenantId })),
  };
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { directSqlRlsOutcome } from '@/lib/hosted-dev/directSqlRlsOutcome';
import { buildHostedDevReport } from '@/lib/hosted-dev/summarizeReport';

describe('direct SQL RLS outcome', () => {
  it('does not pass when psql exits 0 after a FAIL or BLOCKED line', () => {
    expect(
      directSqlRlsOutcome({
        exitCode: 0,
        stdout: 'cross_ok = f\nFAIL: viewer A can read the other tenant\n',
        stderr: 'warning: \\quit: extra argument "1" ignored\n',
      }),
    ).toEqual({ ok: false, message: 'FAIL: viewer A can read the other tenant' });
    expect(
      directSqlRlsOutcome({
        exitCode: 0,
        stdout: 'BLOCKED: viewer A cannot see its own fixture quote\n',
        stderr: 'warning: \\quit: extra argument "2" ignored\n',
      }),
    ).toEqual({
      ok: false,
      message: 'BLOCKED: viewer A cannot see its own fixture quote',
    });
    expect(
      directSqlRlsOutcome({
        exitCode: 0,
        stdout: 'FAIL: tenant_quotes select policy is missing\n',
        stderr: '',
      }).ok,
    ).toBe(false);
  });

  it('keeps a raised verdict and hides connection text', () => {
    expect(
      directSqlRlsOutcome({
        exitCode: 3,
        stdout: '',
        stderr:
          'ERROR:  invalid input syntax for type integer: "FAIL: viewer A can read the other tenant"\n',
      }),
    ).toEqual({ ok: false, message: 'FAIL: viewer A can read the other tenant' });
    expect(
      directSqlRlsOutcome({
        exitCode: 3,
        stdout: '',
        stderr: 'ERROR:  BLOCKED: viewer B cannot see its own fixture quote\n',
      }),
    ).toEqual({
      ok: false,
      message: 'BLOCKED: viewer B cannot see its own fixture quote',
    });
    const refused = directSqlRlsOutcome({
      exitCode: 2,
      stdout: '',
      stderr: 'connection to server failed password=super-secret-db-password',
    });
    expect(refused).toEqual({
      ok: false,
      message: 'FAIL: direct SQL RLS did not finish cleanly.',
    });
    expect(JSON.stringify(refused)).not.toContain('super-secret-db-password');
  });

  it('reports a leak and a missing policy as fail, and a missing fixture as blocked', () => {
    const leak = directSqlRlsOutcome({
      exitCode: 0,
      stdout: 'cross_ok = f\nFAIL: viewer A can read the other tenant\n',
      stderr: 'warning: \\quit: extra argument "1" ignored\n',
    });
    const missingPolicy = directSqlRlsOutcome({
      exitCode: 0,
      stdout: 'FAIL: tenant_quotes select policy is missing\n',
      stderr: '',
    });
    const missingFixture = directSqlRlsOutcome({
      exitCode: 0,
      stdout: 'BLOCKED: viewer A cannot see its own fixture quote\n',
      stderr: 'warning: \\quit: extra argument "2" ignored\n',
    });
    expect(leak.ok).toBe(false);
    expect(missingPolicy.ok).toBe(false);
    expect(missingFixture.ok).toBe(false);
    if (leak.ok || missingPolicy.ok || missingFixture.ok) return;
    expect(reportStatus(leak.message)).toBe('fail');
    expect(reportStatus(missingPolicy.message)).toBe('fail');
    expect(reportStatus(missingFixture.message)).toBe('blocked');
  });

  it('does not use \\quit for a verdict', () => {
    const script = readFileSync('supabase/tests/rls/hosted_dev_cross_tenant.sql', 'utf8');
    expect(script).not.toMatch(/^\s*\\quit/m);
    expect(script).toContain("SELECT CAST('FAIL: viewer A can read the other tenant' AS integer);");
    expect(script).toContain(
      "SELECT CAST('FAIL: tenant_quotes select policy is missing' AS integer);",
    );
    expect(script).toContain(
      "SELECT CAST('BLOCKED: viewer A cannot see its own fixture quote' AS integer);",
    );
  });

  it('passes only a clean zero exit', () => {
    expect(
      directSqlRlsOutcome({
        exitCode: 0,
        stdout: 'ROLLBACK\n',
        stderr: '',
      }),
    ).toEqual({ ok: true });
  });
});

function reportStatus(message: string): string {
  const passed = (title: string) => ({
    title,
    ok: true,
    tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
  });
  const report = buildHostedDevReport({
    target: 'https://dev.cleanscheduler.com',
    env: {
      HOSTED_DEV_ISOLATED: '1',
      HOSTED_DEV_BOOKING_URL: 'https://example.dev.cleanscheduler.com/book',
      QA_DEV_DATABASE_URL: 'postgres://db',
    },
    identityNote: 'ok sha=abc',
    playwright: {
      suites: [
        {
          specs: [
            passed('residential workspace reads stay inside that tenant'),
            passed('commercial workspace reads stay inside that tenant'),
            passed('platform admin can open the tenant list without changing it'),
            passed('customer portal reads quotes, visits, and invoices without paying'),
            passed('cross-tenant quote reads honor RLS for the two fixture users'),
            passed('configured public booking page is read only'),
            {
              title: 'direct SQL RLS matches the dev Supabase project',
              ok: false,
              tests: [
                { status: 'unexpected', results: [{ status: 'failed', error: { message } }] },
              ],
            },
          ],
        },
      ],
    },
  });
  expect(report.overall).toBe('fail');
  const section = report.sections.find(
    (item) => item.id === 'direct SQL RLS matches the dev Supabase project',
  );
  expect(section?.status).not.toBe('pass');
  return section?.status ?? 'missing';
}

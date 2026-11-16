import { describe, expect, it } from 'vitest';
import { directSqlRlsOutcome } from '@/lib/hosted-dev/directSqlRlsOutcome';

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

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  redactJoinedText,
  redactLandingUrl,
  redactPlaintextSecrets,
  redactText,
} from '@/lib/hosted-dev/redactText';

describe('hosted dev artifact redaction', () => {
  it('removes secrets, emails, tokens, and database URLs', () => {
    const redacted = redactText(
      'login jane@example.com Bearer abcdefgh.ijklmnop.qrstuvwxyz sk_live_abc123 postgresql://postgres:secret@db.example.co/postgres password=supersecretvalue',
      ['supersecretvalue'],
    );
    expect(redacted).not.toContain('jane@example.com');
    expect(redacted).not.toContain('sk_live_abc123');
    expect(redacted).not.toContain('postgresql://');
    expect(redacted).not.toContain('supersecretvalue');
    expect(redacted).toContain('[redacted-email]');
  });

  it('redacts short configured secrets and unprefixed webhook or Supabase secrets', () => {
    const redacted = redactText('pw=short sb_secret_abcdefghijklmnopqrst whsec_plainvalue', [
      'short',
    ]);
    expect(redacted).not.toContain('short');
    expect(redacted).not.toContain('sb_secret_');
    expect(redacted).not.toContain('whsec_plainvalue');
  });

  it('redacts non-JWT bearer and authorization values', () => {
    const redacted = redactText(
      '{"name":"authorization","value":"Bearer not-a-jwt=token"} authorization: Bearer custom-session',
      [],
    );
    expect(redacted).not.toContain('not-a-jwt=token');
    expect(redacted).not.toContain('custom-session');
  });

  it('redacts the whole basic authorization header value', () => {
    const redacted = redactText('Authorization: Basic dXNlcjpwYXNz', []);
    expect(redacted).not.toContain('dXNlcjpwYXNz');
    expect(redacted).toBe('Authorization: [redacted]');
  });

  it('redacts encoded addresses and token, code, and email query values', () => {
    const raw =
      'https://admin.dev.cleanscheduler.com/users/jane%40example.com/sign-in?email=jane%40example.com&token=sekret-token&code=sekret-code&next=%2F';
    const redacted = redactText(raw, []);
    expect(redacted).not.toContain('jane');
    expect(redacted).not.toContain('%40');
    expect(redacted).not.toContain('sekret-token');
    expect(redacted).not.toContain('sekret-code');
    expect(redacted).toContain('[redacted-email]');
    expect(redacted).toContain('token=[redacted]');
    expect(redacted).toContain('code=[redacted]');

    const landing = redactLandingUrl(raw);
    expect(landing).not.toContain('jane');
    expect(landing).not.toContain('%40');
    expect(landing).not.toContain('sekret-token');
    expect(landing).not.toContain('sekret-code');
    expect(landing.startsWith('https://admin.dev.cleanscheduler.com/')).toBe(true);
  });

  it('redacts token-like values in the fragment and the extra oauth query keys', () => {
    const raw = [
      'https://admin.dev.cleanscheduler.com/cb',
      '?access_token=query-access&ACCESS_TOKEN=query-access-again',
      '&refresh_token=query-refresh&id_token=query-id',
      '#token=fragment-token&Token=fragment-token-again',
      '&access_token=fragment-access&refresh_token=fragment-refresh&id_token=fragment-id',
    ].join('');
    for (const redacted of [redactText(raw, []), redactLandingUrl(raw)]) {
      expect(redacted).not.toContain('query-access');
      expect(redacted).not.toContain('query-access-again');
      expect(redacted).not.toContain('query-refresh');
      expect(redacted).not.toContain('query-id');
      expect(redacted).not.toContain('fragment-token');
      expect(redacted).not.toContain('fragment-token-again');
      expect(redacted).not.toContain('fragment-access');
      expect(redacted).not.toContain('fragment-refresh');
      expect(redacted).not.toContain('fragment-id');
      expect(redacted).toContain('access_token=[redacted]');
      expect(redacted).toContain('id_token=[redacted]');
    }
  });

  it('redacts a double-encoded address in a path and in a non-url log line', () => {
    const path =
      'https://admin.dev.cleanscheduler.com/users/jane%2540example.com/sign-in?next=%2Fhome';
    const note = 'mailbox jane%2540example.com bounced before sign-in';
    for (const redacted of [redactText(path, []), redactLandingUrl(path), redactText(note, [])]) {
      expect(redacted).not.toContain('jane');
      expect(redacted).not.toContain('%2540');
      expect(redacted).not.toContain('%40');
      expect(redacted).toContain('[redacted-email]');
    }
    expect(redactPlaintextSecrets(note)).not.toContain('%2540');
  });

  it('scrubs a semicolon token assignment that the URL parser would still log', () => {
    // searchParams does not split on `;`. The raw search is `?next=1;token=…`.
    const raw = 'https://admin.dev.cleanscheduler.com/cb?next=1;token=semicolon-token&ok=1';
    const landing = redactLandingUrl(raw);
    expect(landing).not.toContain('semicolon-token');
    expect(landing).toContain('next=1');
    expect(landing).toContain(';token=[redacted]');
    expect(redactText(`landed ${raw}`, [])).not.toContain('semicolon-token');

    const embedded = redactLandingUrl(
      'https://admin.dev.cleanscheduler.com/cb?token=value-with-semicolon;still-secret',
    );
    expect(embedded).not.toContain('value-with-semicolon');
    expect(embedded).not.toContain('still-secret');

    const pathToken = redactLandingUrl(
      'https://admin.dev.cleanscheduler.com/cb;token=path-token?ok=1',
    );
    expect(pathToken).not.toContain('path-token');
    expect(pathToken).toContain(';token=[redacted]');
    expect(pathToken).toContain('?ok=1');
  });

  it('scrubs a semicolon secret before URLSearchParams re-encodes it', () => {
    const raw =
      'https://admin.dev.cleanscheduler.com/cb?next=1;token=semicolon-secret&access_token=query-access&ok=1';
    for (const redacted of [redactLandingUrl(raw), redactText(raw, [])]) {
      expect(redacted).not.toContain('semicolon-secret');
      expect(redacted).not.toContain('query-access');
      expect(redacted).toContain('ok=1');
      expect(redacted).toContain('access_token=[redacted]');
    }
  });

  it('redacts encoded keys, encoded equals, and secrets nested in next', () => {
    const cases = [
      'https://admin.dev.cleanscheduler.com/cb?token%3Deq-secret&next=1',
      'https://admin.dev.cleanscheduler.com/cb?next=1#acc%65ss_token=frag-secret',
      'https://admin.dev.cleanscheduler.com/cb?next=1#%74oken=hash-secret',
      'https://admin.dev.cleanscheduler.com/cb?%2574oken=double-secret&ok=1',
      'https://admin.dev.cleanscheduler.com/sign-in?next=%2Fcb%3Ftoken%3Dnested-secret&ok=1',
      'https://admin.dev.cleanscheduler.com/sign-in?next=%2Fcb%23access_token%3Dnested-hash&ok=1',
    ];
    for (const raw of cases) {
      for (const redacted of [
        redactText(raw, []),
        redactLandingUrl(raw),
        redactPlaintextSecrets(raw),
      ]) {
        expect(redacted, raw).not.toMatch(
          /eq-secret|frag-secret|hash-secret|double-secret|nested-secret|nested-hash/,
        );
      }
    }
    expect(redactText(cases[0] ?? '', [])).toContain('next=1');
    expect(redactLandingUrl(cases[3] ?? '')).toContain('ok=1');
    expect(redactLandingUrl(cases[4] ?? '')).toContain('ok=1');
    expect(redactLandingUrl(cases[5] ?? '')).toContain('ok=1');
  });

  it('redacts the extra credential names and unquoted or quoted token tails', () => {
    const raw = [
      'https://admin.dev.cleanscheduler.com/cb#provider_token=prov-token&provider_refresh_token=prov-refresh',
      '?code_verifier=verifier-secret&client_secret=client-secret&token_hash=hash-secret',
      '?idToken=camel-id&accessToken=camel-access',
      'landed token=bare-secret next',
      'https://admin.dev.cleanscheduler.com/cb?token="quoted-secret"&ok=1',
      'https://admin.dev.cleanscheduler.com/cb?token=left right&next=keep#refresh_token=left right',
    ].join('\n');
    for (const redacted of [redactText(raw, []), redactPlaintextSecrets(raw)]) {
      expect(redacted).not.toContain('prov-token');
      expect(redacted).not.toContain('prov-refresh');
      expect(redacted).not.toContain('verifier-secret');
      expect(redacted).not.toContain('client-secret');
      expect(redacted).not.toContain('hash-secret');
      expect(redacted).not.toContain('camel-id');
      expect(redacted).not.toContain('camel-access');
      expect(redacted).not.toContain('bare-secret');
      expect(redacted).not.toContain('quoted-secret');
      expect(redacted).toContain('token=[redacted] right');
      expect(redacted).toContain('refresh_token=[redacted] right');
      expect(redacted).toContain('token=[redacted]');
      expect(redacted).toContain('next=keep');
    }
  });

  it('redacts a credential through semicolon and question-mark tails', () => {
    const fragment = redactText(
      'https://admin.dev.cleanscheduler.com/cb#refresh_token=left;right-secret',
      [],
    );
    expect(fragment).not.toContain('right-secret');
    expect(fragment).not.toContain('left');
    expect(fragment).toContain('#refresh_token=[redacted]');

    const landing = redactLandingUrl(
      'https://admin.dev.cleanscheduler.com/cb#access_token=left?right-secret&ok=1',
    );
    expect(landing).not.toContain('right-secret');
    expect(landing).toContain('#access_token=[redacted]');
    expect(landing).toContain('ok=1');

    const pathToken = redactText('https://admin.dev.cleanscheduler.com/cb;token=x?ok=1', []);
    expect(pathToken).not.toContain('token=x');
    expect(pathToken).toContain(';token=[redacted]');
    expect(pathToken).toContain('?ok=1');
  });

  it('stops an assignment at whitespace and keeps an http status', () => {
    const prose = redactText('code=200 OK request=/health\nemail=sent to the office', []);
    expect(prose).toContain('code=200 OK request=/health');
    expect(prose).toContain('email=[redacted]');
    expect(prose).not.toContain('sent to the office');
    const report = [
      '| deployment identity | fail | reject: identity token=bare-secret rejected |',
      '| public booking read | blocked | HOSTED_DEV_BOOKING_URL is not set. |',
    ].join('\n');
    const redacted = redactText(report, []);
    expect(redacted).not.toContain('bare-secret');
    expect(redacted).toContain('public booking read');
    expect(redacted).toContain('HOSTED_DEV_BOOKING_URL is not set.');
  });

  it('redacts json credentials, auth cookies, passwords, and joined text nodes', () => {
    const raw = [
      '{"refresh_token":"opaque-refresh-secret","access_token":"opaque-access-secret","code":"200"}',
      'sb-abcdefghijklmnop-auth-token=opaque-cookie-session',
      'password=password-secret',
      'Authorization: Bearer bearer-opaque-secret',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    ].join('\n');
    const redacted = redactText(raw, []);
    expect(redacted).not.toContain('opaque-refresh-secret');
    expect(redacted).not.toContain('opaque-access-secret');
    expect(redacted).not.toContain('opaque-cookie-session');
    expect(redacted).not.toContain('password-secret');
    expect(redacted).not.toContain('bearer-opaque-secret');
    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(redacted).toContain('"code":"200"');

    const joined = redactJoinedText(['token=', 'split-secret'], []);
    expect(joined[0]).toContain('token=[redacted]');
    expect(joined.join('')).not.toContain('split-secret');
    expect(joined[1]).toBe('');
    const tail = redactJoinedText(['#refresh_token=', 'left;right-secret'], []);
    expect(tail.join('')).not.toContain('right-secret');
    expect(tail[1]).toBe('');
  });

  it('does not treat an image filename as an encoded address', () => {
    const raw = 'saved img%2540x2.png beside jane%2540example.com';
    const redacted = redactPlaintextSecrets(raw);
    expect(redacted).toContain('img%2540x2.png');
    expect(redacted).not.toContain('jane');
    expect(redacted).toContain('[redacted-email]');
  });

  it('stays linear on a long percent run', () => {
    const once = redactText('%25'.repeat(1000) + 'xx', []);
    expect(once).toContain('%25');
    const measure = (count: number) => {
      const input = '%25'.repeat(count) + 'xx';
      const started = performance.now();
      const redacted = redactText(input, []);
      return { elapsed: performance.now() - started, redacted, input };
    };
    measure(2000);
    const small = measure(4000);
    const large = measure(16000);
    expect(small.redacted).toBe(small.input);
    expect(large.redacted).toBe(large.input);
    expect(large.elapsed).toBeLessThan(1000);
    expect(large.elapsed).toBeLessThan(small.elapsed * 12 + 50);
  });
});

function jobSource(workflow: string, name: string): string {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  if (start < 0) throw new Error(`missing job ${name}`);
  const rest = workflow.slice(start + 1);
  const next = rest.indexOf('\n  hosted-dev-', 1);
  return next < 0 ? rest : rest.slice(0, next);
}

describe('hosted dev workflow contract', () => {
  const workflow = readFileSync('.github/workflows/hosted-dev.yml', 'utf8');

  it('filters to the custom dev environment and keeps secrets off the smoke job', () => {
    expect(workflow).toContain("github.event.deployment.environment == 'dev'");
    expect(workflow).toContain("github.event.deployment_status.state == 'success'");
    expect(workflow).toContain("github.event.deployment.task == 'deploy'");
    expect(workflow).toContain('github.event.deployment.production_environment == false');
    expect(workflow).toContain("github.event.deployment.creator.login == 'vercel[bot]'");
    expect(workflow).toContain('refs/heads/main');
    expect(workflow).toContain('rev-parse origin/dev');
    expect(workflow).not.toContain('merge-base --is-ancestor');
    expect(workflow).not.toContain('QA_DEV_DATABASE_URL');
    expect(workflow).toContain('3d3c42e5aac5ba805825da76410c181273ba90b1');
    expect(workflow).toContain('49933ea5288caeca8642d1e84afbd3f7d6820020');
    expect(workflow).toContain('ea165f8d65b6e75b540449e92b4886f43607fa02');
    expect(workflow).toContain('npm ci --ignore-scripts');
    expect(workflow).not.toContain('pull_request');
    expect(workflow).not.toContain('workflow_run');
    expect(workflow).not.toContain('A copy that exists only on dev does not run');

    const smoke = jobSource(workflow, 'hosted-dev-smoke');
    const isolated = jobSource(workflow, 'hosted-dev-isolated');
    expect(smoke).not.toContain('secrets.');
    expect(smoke).not.toContain('environment:');
    expect(smoke).not.toContain('hosted-dev-isolated');
    expect(isolated).toContain('environment: hosted-dev-isolated');
    expect(isolated).toContain('secrets.QA_TENANT_RESIDENTIAL_PASSWORD');
    expect(isolated).toContain("vars.HOSTED_DEV_ISOLATED == '1'");
    expect(isolated).toContain("endsWith(github.workflow_ref, '@refs/heads/main')");
    expect(workflow.match(/^ {4}environment: hosted-dev-isolated$/gm)).toEqual([
      '    environment: hosted-dev-isolated',
    ]);
  });
});

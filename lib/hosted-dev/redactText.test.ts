import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { redactText } from '@/lib/hosted-dev/redactText';

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

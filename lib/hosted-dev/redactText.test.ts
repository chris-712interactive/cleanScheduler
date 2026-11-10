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
});

describe('hosted dev workflow contract', () => {
  const workflow = readFileSync('.github/workflows/hosted-dev.yml', 'utf8');

  it('filters to the custom dev environment and keeps secrets off the smoke job', () => {
    expect(workflow).toContain("github.event.deployment.environment == 'dev'");
    expect(workflow).toContain("github.event.deployment_status.state == 'success'");
    expect(workflow).toContain("github.event.deployment.task == 'deploy'");
    expect(workflow).toContain('github.event.deployment.production_environment == false');
    expect(workflow).toContain("github.event.deployment.creator.login == 'vercel[bot]'");
    expect(workflow).toContain('refs/heads/main');
    expect(workflow).toContain('npm ci --ignore-scripts');
    expect(workflow).not.toContain('pull_request');
    expect(workflow).not.toContain('workflow_run');
    const smoke = workflow.split('hosted-dev-isolated')[0] ?? '';
    expect(smoke).not.toContain('secrets.');
  });
});

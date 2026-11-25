import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = path.join(import.meta.dirname, 'vercel-ignore-build.sh');

type Env = Record<string, string | undefined>;

function runIgnore(overrides: Env, cwd?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('VERCEL_')) {
      delete env[key];
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  const result = spawnSync('bash', [scriptPath], {
    cwd,
    env,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  };
}

function git(cwd: string, args: string[]) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Vercel Ignore Test',
      GIT_AUTHOR_EMAIL: 'vercel-ignore@example.test',
      GIT_COMMITTER_NAME: 'Vercel Ignore Test',
      GIT_COMMITTER_EMAIL: 'vercel-ignore@example.test',
    },
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return (result.stdout ?? '').trim();
}

function commitFiles(cwd: string, files: Record<string, string>) {
  for (const [file, contents] of Object.entries(files)) {
    const full = path.join(cwd, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  git(cwd, ['add', '--', '.']);
  git(cwd, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'test']);
  return git(cwd, ['rev-parse', 'HEAD']);
}

function initRepo() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'vercel-ignore-'));
  git(cwd, ['init', '-b', 'main']);
  git(cwd, ['config', 'user.email', 'vercel-ignore@example.test']);
  git(cwd, ['config', 'user.name', 'Vercel Ignore Test']);
  const base = commitFiles(cwd, { 'app/page.tsx': 'export {}\n' });
  const docs = commitFiles(cwd, {
    'docs/agents/note.md': '# note\n',
    'README.md': '# readme\n',
    'AGENTS.md': '# agents\n',
    'CLAUDE.md': '# claude\n',
    '.cursor/rules/example.mdc': 'rule\n',
  });
  const app = commitFiles(cwd, { 'lib/example.ts': 'export {}\n' });
  return { cwd, base, docs, app };
}

describe('vercel ignore build step', () => {
  it('always builds production, including dependabot with no pull request', () => {
    const result = runIgnore({
      VERCEL_ENV: 'preview',
      VERCEL_TARGET_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'dependabot/npm_and_yarn/next',
      VERCEL_GIT_PULL_REQUEST_ID: '',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('build: VERCEL_TARGET_ENV=production');
    expect(result.stderr).toBe('');
  });

  it('builds the dev custom environment even when VERCEL_ENV is preview', () => {
    const result = runIgnore({
      VERCEL_ENV: 'preview',
      VERCEL_TARGET_ENV: 'dev',
      VERCEL_GIT_COMMIT_REF: 'feature/not-dev',
      VERCEL_GIT_PULL_REQUEST_ID: '',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('build: VERCEL_TARGET_ENV=dev');
  });

  it('builds when the git ref is dev and the target env is preview', () => {
    const result = runIgnore({
      VERCEL_ENV: 'preview',
      VERCEL_TARGET_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'dev',
      VERCEL_GIT_PULL_REQUEST_ID: '',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('build: VERCEL_GIT_COMMIT_REF=dev');
  });

  it('builds when the deployment is not a known preview', () => {
    expect(
      runIgnore({
        VERCEL_ENV: 'preview',
      }),
    ).toMatchObject({ status: 1, stdout: 'build: not a preview (fail open)' });
    expect(runIgnore({})).toMatchObject({
      status: 1,
      stdout: 'build: not a preview (fail open)',
    });
    expect(
      runIgnore({
        VERCEL_TARGET_ENV: 'staging',
        VERCEL_GIT_COMMIT_REF: 'feature/x',
        VERCEL_GIT_PULL_REQUEST_ID: '',
      }),
    ).toMatchObject({ status: 1, stdout: 'build: not a preview (fail open)' });
  });

  it('skips dependabot preview branches', () => {
    const result = runIgnore({
      VERCEL_TARGET_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'dependabot/npm_and_yarn/next-16.4.5',
      VERCEL_GIT_PULL_REQUEST_ID: '42',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('skip: branch starts with dependabot/');
  });

  it('does not treat a branch that only contains dependabot as a dependabot branch', () => {
    const result = runIgnore({
      VERCEL_TARGET_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'feature/dependabot-notes',
      VERCEL_GIT_PULL_REQUEST_ID: '',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('skip: no open pull request');
  });

  it('skips preview commits that are not on an open pull request', () => {
    const result = runIgnore({
      VERCEL_TARGET_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'feature/schedule',
      VERCEL_GIT_PULL_REQUEST_ID: '   ',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('skip: no open pull request');
  });

  it('builds a preview pull request when there is no previous SHA', () => {
    const result = runIgnore({
      VERCEL_TARGET_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'feature/schedule',
      VERCEL_GIT_PULL_REQUEST_ID: '18',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('build: preview with an open pull request');
  });

  it('skips a docs-only preview diff and builds when application files change', () => {
    const repo = initRepo();
    const preview = {
      VERCEL_TARGET_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'feature/docs',
      VERCEL_GIT_PULL_REQUEST_ID: '7',
    };

    git(repo.cwd, ['checkout', '--detach', repo.docs]);
    expect(runIgnore({ ...preview, VERCEL_GIT_PREVIOUS_SHA: repo.base }, repo.cwd)).toMatchObject({
      status: 0,
      stdout: 'skip: docs-only change',
    });

    git(repo.cwd, ['checkout', '--detach', repo.app]);
    expect(runIgnore({ ...preview, VERCEL_GIT_PREVIOUS_SHA: repo.docs }, repo.cwd)).toMatchObject({
      status: 1,
      stdout: 'build: preview has application changes',
    });
  });

  it('builds when the previous SHA is missing from the clone', () => {
    const repo = initRepo();
    const missing = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const result = runIgnore(
      {
        VERCEL_TARGET_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'feature/docs',
        VERCEL_GIT_PULL_REQUEST_ID: '7',
        VERCEL_GIT_PREVIOUS_SHA: missing,
      },
      repo.cwd,
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('build: git diff could not be computed');
  });

  it('builds when a shallow clone does not contain the previous SHA', () => {
    const repo = initRepo();
    const shallow = mkdtempSync(path.join(tmpdir(), 'vercel-ignore-shallow-'));
    git(shallow, ['clone', '--depth', '1', `file://${repo.cwd}`, '.']);
    const result = runIgnore(
      {
        VERCEL_TARGET_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'feature/docs',
        VERCEL_GIT_PULL_REQUEST_ID: '7',
        VERCEL_GIT_PREVIOUS_SHA: repo.base,
      },
      shallow,
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('build: git diff could not be computed');
  });
});

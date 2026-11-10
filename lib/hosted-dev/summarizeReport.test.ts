import { describe, expect, it } from 'vitest';
import { buildHostedDevReport } from '@/lib/hosted-dev/summarizeReport';

const env = {
  HOSTED_DEV_BOOKING_URL: 'https://example.dev.cleanscheduler.com/book',
  HOSTED_DEV_ISOLATED: '1',
  QA_DEV_DATABASE_URL: 'postgres://db',
};

describe('hosted dev report', () => {
  it('fails a skipped Playwright result and does not call it a pass', () => {
    const report = buildHostedDevReport({
      target: 'https://dev.cleanscheduler.com',
      env,
      identityNote: 'ok sha=abc',
      playwright: {
        suites: [
          {
            specs: [
              {
                title: 'sign-in page renders and is not submitted',
                ok: true,
                tests: [{ status: 'skipped', results: [{ status: 'skipped' }] }],
              },
            ],
          },
        ],
      },
    });
    expect(report.overall).toBe('fail');
    expect(report.sections.find((section) => section.id.startsWith('sign-in'))).toMatchObject({
      status: 'fail',
    });
  });

  it('keeps the suppression row and fails when mutations are requested', () => {
    const report = buildHostedDevReport({
      target: 'https://dev.cleanscheduler.com',
      env: {
        HOSTED_DEV_BOOKING_URL: 'https://example.dev.cleanscheduler.com/book',
        HOSTED_DEV_MUTATIONS: '1',
        QA_DEV_DATABASE_URL: 'postgres://db',
      },
      identityNote: 'ok sha=abc',
      playwright: {
        suites: [
          {
            specs: [
              {
                title: 'marketing home and pricing render',
                ok: true,
                tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
              },
            ],
          },
        ],
      },
    });
    expect(report.overall).toBe('fail');
    expect(report.sections.find((section) => section.id.startsWith('mutations'))).toMatchObject({
      status: 'blocked',
    });
  });

  it('keeps authenticated and RLS rows when setup produces no Playwright file', () => {
    const report = buildHostedDevReport({
      target: 'https://dev.cleanscheduler.com',
      env,
      identityNote: 'reject: setup failed',
      playwright: null,
    });
    expect(report.overall).toBe('fail');
    expect(report.sections.find((section) => section.id === 'cross-tenant RLS')).toMatchObject({
      status: 'fail',
    });
    expect(
      report.sections.find(
        (section) => section.id === 'authenticated tenant, admin, and customer reads',
      ),
    ).toMatchObject({ status: 'fail' });
  });
});

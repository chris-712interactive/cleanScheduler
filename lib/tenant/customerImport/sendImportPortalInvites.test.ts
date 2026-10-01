import { describe, expect, it } from 'vitest';
import type { CustomerPortalInviteResult } from '@/lib/tenant/customerPortalInvite';
import { tallyPortalInviteResult } from '@/lib/tenant/customerImport/sendImportPortalInvites';
import type { CustomerImportInviteSummary } from '@/lib/tenant/customerImport/types';

function emptySummary(): CustomerImportInviteSummary {
  return { emailed: 0, skippedNoEmail: 0, alreadyLinked: 0, failed: 0 };
}

describe('tallyPortalInviteResult', () => {
  it('counts emailed, missing email, already linked, and failures separately', () => {
    const summary = emptySummary();
    const results: CustomerPortalInviteResult[] = [
      {
        ok: true,
        token: 't',
        acceptUrl: 'https://example.com',
        email: 'a@example.com',
        emailed: true,
        alreadyLinked: false,
      },
      { ok: false, error: 'Add an email address before sending a portal invite.' },
      { ok: true, alreadyLinked: true, email: 'b@example.com' },
      { ok: false, error: 'Resend rejected the message.' },
    ];

    for (const result of results) tallyPortalInviteResult(summary, result);

    expect(summary).toEqual({
      emailed: 1,
      skippedNoEmail: 1,
      alreadyLinked: 1,
      failed: 1,
      error: 'Resend rejected the message.',
    });
  });
});

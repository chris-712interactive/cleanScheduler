import { describe, expect, it } from 'vitest';
import { parseOutreachCsv } from '@/lib/admin/parseOutreachCsv';

const HEADER =
  '"Business Name","Owner Name","Email","Phone","City","County","Type","Website","Has Email","Outreach Channel","Subject","Body","Notes"';

describe('parseOutreachCsv', () => {
  it('parses SWFL-style mail-merge rows including multiline body', () => {
    const csv = [
      HEADER,
      '"Truly Kleen","Unknown","contact@example.com","(239) 412-4633","Fort Myers","Lee","Both","https://example.com/","Yes","Email","Hello Fort Myers","Hi there,\n\nShort ask.","Note A"',
      '"No Email Co","Unknown","","(239) 000-0000","Naples","Collier","Residential","","No","Phone","","",""',
    ].join('\n');

    const result = parseOutreachCsv(csv);
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      businessName: 'Truly Kleen',
      email: 'contact@example.com',
      emailNormalized: 'contact@example.com',
      city: 'Fort Myers',
      subject: 'Hello Fort Myers',
    });
    expect(result.rows[0]!.bodyText).toContain('Short ask.');
    expect(result.skippedMissingEmail).toBe(1);
  });

  it('requires Email, Subject, and Body columns', () => {
    const result = parseOutreachCsv('Name,Email\nAcme,a@example.com\n');
    expect(result.rows).toHaveLength(0);
    expect(result.error).toMatch(/Subject and Body/i);
  });

  it('dedupes by normalized email', () => {
    const csv = ['Email,Subject,Body', 'A@Example.com,Sub1,Body1', 'a@example.com,Sub2,Body2'].join(
      '\n',
    );
    const result = parseOutreachCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.subject).toBe('Sub1');
  });
});

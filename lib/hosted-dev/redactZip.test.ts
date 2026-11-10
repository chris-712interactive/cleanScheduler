import { describe, expect, it } from 'vitest';
import { redactZipBuffer, readZip, writeZip } from '@/lib/hosted-dev/redactZip';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);

function entry(zip: Buffer, name: string): string {
  const found = readZip(zip).find((item) => item.name === name);
  expect(found, name).toBeTruthy();
  return found?.data.toString('utf8') ?? '';
}

describe('trace zip redaction', () => {
  it.each([0, 8] as const)(
    'scrubs extensionless text, drops extensionless images, and redacts bearer values (method %i)',
    (method) => {
      const zip = writeZip(
        [
          {
            name: 'resources/abc123deadbeef',
            data: Buffer.from(
              'password=shortpw sb_secret_abcdefghijklmnopqrst whsec_plainvalue jane@example.com',
            ),
          },
          {
            name: 'resources/78485ad26ab49de2007fe98b0854715a58aaf5b6',
            data: PNG,
          },
          {
            name: 'page.har',
            data: Buffer.from(
              '{"name":"authorization","value":"Bearer not-a-jwt=token"} authorization: Bearer custom-session',
            ),
          },
        ],
        method,
      );
      const redacted = redactZipBuffer(zip, ['shortpw']);
      const names = readZip(redacted).map((item) => item.name);
      expect(names).not.toContain('resources/78485ad26ab49de2007fe98b0854715a58aaf5b6');
      expect(names).toContain('redacted-omitted-binaries.txt');

      const resource = entry(redacted, 'resources/abc123deadbeef');
      expect(resource).not.toContain('shortpw');
      expect(resource).not.toContain('sb_secret_abcdefghijklmnopqrst');
      expect(resource).not.toContain('whsec_plainvalue');
      expect(resource).not.toContain('jane@example.com');

      const har = entry(redacted, 'page.har');
      expect(har).not.toContain('not-a-jwt=token');
      expect(har).not.toContain('custom-session');
      expect(har).toContain('[redacted]');
    },
  );
});

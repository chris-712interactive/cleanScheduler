import { describe, expect, it } from 'vitest';
import { emailSubjectLine } from '@/lib/email/emailSubject';

describe('emailSubjectLine', () => {
  it('collapses CR, LF, and other controls into a single space', () => {
    expect(emailSubjectLine('Casey\r\nBcc: evil@example.com')).toBe('Casey Bcc: evil@example.com');
    expect(emailSubjectLine('Acme\u0000Cleaning')).toBe('Acme Cleaning');
    expect(emailSubjectLine('  Weekly\tclean  ')).toBe('Weekly clean');
  });
});

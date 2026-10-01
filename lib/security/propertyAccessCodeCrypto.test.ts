import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptPropertyAccessCodes,
  encryptPropertyAccessCodes,
} from '@/lib/security/propertyAccessCodeCrypto';
import {
  formatPropertyAccessCodes,
  hasPropertyAccessCodes,
  parsePropertyAccessCodesFromForm,
} from '@/lib/tenant/propertyAccessCodes';

const tenantId = 'tenant-1';
const propertyId = 'property-1';

describe('property access codes', () => {
  it('round-trips codes and keeps the plaintext out of the stored payload', () => {
    process.env.PROPERTY_ACCESS_CODE_KEY = randomBytes(32).toString('base64');
    const codes = { gateCode: '4412', doorCode: '19', garageCode: '1553' };
    const payload = encryptPropertyAccessCodes(tenantId, propertyId, codes);

    expect(payload.startsWith('v1.')).toBe(true);
    expect(payload).not.toContain('4412');
    expect(payload).not.toContain('1553');
    expect(decryptPropertyAccessCodes(tenantId, propertyId, payload)).toEqual(codes);
  });

  it('refuses a payload moved onto a different property', () => {
    process.env.PROPERTY_ACCESS_CODE_KEY = randomBytes(32).toString('base64');
    const payload = encryptPropertyAccessCodes(tenantId, propertyId, {
      gateCode: '4412',
      doorCode: '',
      garageCode: '',
    });

    expect(() => decryptPropertyAccessCodes(tenantId, 'property-2', payload)).toThrow();
  });

  it('reads the three code fields from a form without treating blanks as values', () => {
    const form = new FormData();
    form.set('gate_code', ' 4412 ');
    form.set('door_code', '');
    const codes = parsePropertyAccessCodesFromForm(form);
    expect(codes).toEqual({ gateCode: '4412', doorCode: '', garageCode: '' });
    expect(hasPropertyAccessCodes(codes)).toBe(true);
    expect(formatPropertyAccessCodes(codes)).toBe('Gate code: 4412');
  });
});

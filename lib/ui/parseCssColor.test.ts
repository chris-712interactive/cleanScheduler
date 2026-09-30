import { describe, expect, it } from 'vitest';
import { parseCssColorToHex } from '@/lib/ui/parseCssColor';

describe('parseCssColorToHex', () => {
  it('accepts hex and rgb values', () => {
    expect(parseCssColorToHex('#0d9488')).toBe('#0D9488');
    expect(parseCssColorToHex('#abc')).toBe('#AABBCC');
    expect(parseCssColorToHex('rgb(13, 148, 136)')).toBe('#0D9488');
    expect(parseCssColorToHex('13, 148, 136')).toBe('#0D9488');
  });

  it('rejects values that are not a color', () => {
    expect(parseCssColorToHex('teal')).toBeNull();
    expect(parseCssColorToHex('rgb(300, 0, 0)')).toBeNull();
    expect(parseCssColorToHex('')).toBeNull();
  });
});

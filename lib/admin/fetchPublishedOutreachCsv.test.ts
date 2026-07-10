import { describe, expect, it } from 'vitest';
import { normalizePublishedGoogleSheetCsvUrl } from '@/lib/admin/fetchPublishedOutreachCsv';

describe('normalizePublishedGoogleSheetCsvUrl', () => {
  it('accepts published-to-web CSV URLs', () => {
    const result = normalizePublishedGoogleSheetCsvUrl(
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vExample/pub?output=csv',
    );
    expect(result.ok).toBe(true);
  });

  it('accepts public export CSV URLs with gid', () => {
    const result = normalizePublishedGoogleSheetCsvUrl(
      'https://docs.google.com/spreadsheets/d/1AbCdEf/export?format=csv&gid=0',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects edit/share URLs', () => {
    const result = normalizePublishedGoogleSheetCsvUrl(
      'https://docs.google.com/spreadsheets/d/1AbCdEf/edit#gid=0',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Publish to web/i);
    }
  });

  it('rejects non-Google hosts', () => {
    const result = normalizePublishedGoogleSheetCsvUrl('https://example.com/file.csv');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/docs\.google\.com/i);
    }
  });
});

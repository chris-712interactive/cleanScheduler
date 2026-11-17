import { describe, expect, it } from 'vitest';
import { postLoginUsesDocumentNavigation } from '@/lib/auth/postLoginNavigation';

describe('postLoginUsesDocumentNavigation', () => {
  it('loads the portal root as a document and keeps deeper paths on the client', () => {
    expect(postLoginUsesDocumentNavigation('https://admin.dev.cleanscheduler.com/')).toBe(true);
    expect(postLoginUsesDocumentNavigation('https://admin.dev.cleanscheduler.com/?next=1')).toBe(
      true,
    );
    expect(postLoginUsesDocumentNavigation('https://admin.dev.cleanscheduler.com/tenants')).toBe(
      false,
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatSupportAuthorName,
  supportMessageSenderLabel,
} from '@/lib/messaging/supportMessageAuthor';

describe('formatSupportAuthorName', () => {
  it('uses the profile display name', () => {
    expect(
      formatSupportAuthorName({
        display_name: ' Chris Kendig ',
        first_name: 'Christopher',
        last_name: 'Kendig',
      }),
    ).toBe('Chris Kendig');
  });

  it('falls back to first and last name', () => {
    expect(
      formatSupportAuthorName({ display_name: ' ', first_name: 'Ada', last_name: 'Lovelace' }),
    ).toBe('Ada Lovelace');
  });
});

describe('supportMessageSenderLabel', () => {
  const base = {
    customerName: 'Wayne Kendig',
    tenantName: 'Acme Cleaning',
  };

  it('shows each staff sender on the tenant thread', () => {
    expect(
      supportMessageSenderLabel({
        ...base,
        isFromCustomer: false,
        authorDisplayName: 'Chris Kendig',
        customerSide: false,
      }),
    ).toBe('Chris Kendig');
    expect(
      supportMessageSenderLabel({
        ...base,
        isFromCustomer: false,
        authorDisplayName: null,
        customerSide: false,
      }),
    ).toBe('Team member');
  });

  it('shows the staff sender to the customer, and You on their own messages', () => {
    expect(
      supportMessageSenderLabel({
        ...base,
        isFromCustomer: false,
        authorDisplayName: 'Chris Kendig',
        customerSide: true,
      }),
    ).toBe('Chris Kendig');
    expect(
      supportMessageSenderLabel({
        ...base,
        isFromCustomer: true,
        authorDisplayName: 'Wayne Kendig',
        authorUserId: 'customer-1',
        currentUserId: 'customer-1',
        customerSide: true,
      }),
    ).toBe('You');
  });
});

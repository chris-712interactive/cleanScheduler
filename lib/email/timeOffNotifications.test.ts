import { describe, expect, it } from 'vitest';
import { selectTimeOffNotifyEmails } from '@/lib/email/timeOffNotifications';

describe('selectTimeOffNotifyEmails', () => {
  it('emails other owners and admins, not the person requesting time off', () => {
    expect(
      selectTimeOffNotifyEmails({
        reviewers: [
          { userId: 'owner', email: 'owner@example.com' },
          { userId: 'admin', email: 'office@example.com' },
          { userId: 'crew', email: 'crew@example.com' },
        ],
        excludeUserId: 'crew',
        fallbackEmails: ['owner@example.com'],
      }),
    ).toEqual(['owner@example.com', 'office@example.com']);
  });

  it('uses the company inbox when no other owner or admin has a login email', () => {
    expect(
      selectTimeOffNotifyEmails({
        reviewers: [{ userId: 'crew', email: 'crew@example.com' }],
        excludeUserId: 'crew',
        fallbackEmails: ['crew@example.com', 'office@example.com'],
      }),
    ).toEqual(['office@example.com']);
  });

  it('does not email someone about their own request when they are the only reviewer', () => {
    expect(
      selectTimeOffNotifyEmails({
        reviewers: [{ userId: 'owner', email: 'owner@example.com' }],
        excludeUserId: 'owner',
        fallbackEmails: ['owner@example.com'],
      }),
    ).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { readOnlyBookingUrlProblem } from '@/lib/hosted-dev/readOnlyBookingUrl';

describe('read-only public booking URL', () => {
  it('accepts an allowlisted /book page', () => {
    expect(readOnlyBookingUrlProblem('https://acme.dev.cleanscheduler.com/book')).toBeNull();
  });

  it('refuses a non-book path and a checkout return token', () => {
    expect(readOnlyBookingUrlProblem('https://acme.dev.cleanscheduler.com/')).toMatch(/not \/book/);
    expect(
      readOnlyBookingUrlProblem('https://acme.dev.cleanscheduler.com/book?booking=hold-token'),
    ).toMatch(/completion token/);
    expect(
      readOnlyBookingUrlProblem('https://acme.dev.cleanscheduler.com/book?Booking=canceled'),
    ).toMatch(/completion token/);
    expect(readOnlyBookingUrlProblem('https://checkout.stripe.com/pay')).toMatch(/BLOCKED:/);
  });
});

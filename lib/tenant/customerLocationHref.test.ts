import { describe, expect, it } from 'vitest';
import { customerLocationDomId, customerLocationEditHref } from '@/lib/tenant/customerLocationHref';

describe('customer location edit link', () => {
  it('points at the location on the customer page', () => {
    const propertyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(customerLocationDomId(propertyId)).toBe(`location-${propertyId}`);
    expect(customerLocationEditHref('customer-1', propertyId)).toBe(
      `/customers/customer-1#location-${propertyId}`,
    );
    expect(customerLocationEditHref('customer-1', propertyId)).not.toBe('/customers/customer-1');
  });
});

/** In-page anchor for one service location on the customer profile. */
export function customerLocationDomId(propertyId: string): string {
  return `location-${propertyId}`;
}

/** Opens the customer profile on that location, not the account overview. */
export function customerLocationEditHref(customerId: string, propertyId: string): string {
  return `/customers/${customerId}#${customerLocationDomId(propertyId)}`;
}

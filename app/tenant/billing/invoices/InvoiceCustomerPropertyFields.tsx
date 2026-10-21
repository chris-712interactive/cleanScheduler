'use client';

import { useMemo, useState } from 'react';
import styles from '../billing.module.scss';

export type InvoiceCustomerOption = {
  id: string;
  label: string;
  properties: Array<{ id: string; label: string }>;
};

function initialPropertyId(
  customers: InvoiceCustomerOption[],
  customerId: string,
  propertyId: string,
): string {
  const properties = customers.find((customer) => customer.id === customerId)?.properties ?? [];
  if (properties.some((property) => property.id === propertyId)) return propertyId;
  if (properties.length === 1) return properties[0]?.id ?? '';
  return '';
}

export function InvoiceCustomerPropertyFields({
  customers,
  defaultCustomerId,
  defaultPropertyId,
}: {
  customers: InvoiceCustomerOption[];
  defaultCustomerId: string;
  defaultPropertyId: string;
}) {
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [propertyId, setPropertyId] = useState(() =>
    initialPropertyId(customers, defaultCustomerId, defaultPropertyId),
  );

  const properties = useMemo(
    () => customers.find((customer) => customer.id === customerId)?.properties ?? [],
    [customers, customerId],
  );

  function onCustomerChange(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    const nextProperties =
      customers.find((customer) => customer.id === nextCustomerId)?.properties ?? [];
    if (nextProperties.some((property) => property.id === propertyId)) return;
    setPropertyId(initialPropertyId(customers, nextCustomerId, ''));
  }

  return (
    <>
      <label className={styles.field}>
        <span>Customer</span>
        <select
          name="customer_id"
          required
          className={styles.select}
          value={customerId}
          onChange={(event) => onCustomerChange(event.target.value)}
        >
          <option value="">Select…</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Property</span>
        <select
          name="property_id"
          className={styles.select}
          value={properties.some((property) => property.id === propertyId) ? propertyId : ''}
          required={properties.length > 0}
          onChange={(event) => setPropertyId(event.target.value)}
        >
          <option value="">{properties.length === 0 ? 'No property on file' : 'Select…'}</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

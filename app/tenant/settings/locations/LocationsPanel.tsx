'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  createTenantLocationAction,
  deleteTenantLocationAction,
  toggleTenantLocationAction,
  type LocationActionState,
} from './actions';
import styles from '../settings.module.scss';

const initialState: LocationActionState = {};

export function LocationsPanel({
  tenantSlug,
  canEdit,
  locations,
}: {
  tenantSlug: string;
  canEdit: boolean;
  locations: Array<{
    id: string;
    name: string;
    code: string | null;
    is_active: boolean;
  }>;
}) {
  const [state, formAction, pending] = useActionState(createTenantLocationAction, initialState);

  return (
    <div className={styles.integrationsStack}>
      {state.error ? (
        <p className={styles.opsError} role="alert">
          {state.error}
        </p>
      ) : null}

      {locations.length === 0 ? (
        <p className={styles.opsIntro}>
          No locations yet. Add a branch or territory to tag visits and invoices.
        </p>
      ) : (
        <ul className={styles.integrationsList}>
          {locations.map((loc) => (
            <li key={loc.id} className={styles.integrationsListItem}>
              <div>
                <strong>{loc.name}</strong>
                <span className={styles.integrationsMeta}>
                  {loc.code ? `Code ${loc.code} · ` : ''}
                  {loc.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {canEdit ? (
                <div className={styles.integrationsActions}>
                  <form action={toggleTenantLocationAction}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="location_id" value={loc.id} />
                    <input type="hidden" name="enabled" value={loc.is_active ? 'false' : 'true'} />
                    <Button type="submit" size="sm" variant="secondary">
                      {loc.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </form>
                  <form action={deleteTenantLocationAction}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="location_id" value={loc.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      Delete
                    </Button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form action={formAction} className={styles.integrationsForm}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <label className={styles.opsField}>
            <span className={styles.opsLabel}>Location name</span>
            <input
              className={styles.opsInput}
              name="name"
              placeholder="North county crew"
              required
              disabled={pending}
            />
          </label>
          <label className={styles.opsField}>
            <span className={styles.opsLabel}>Short code (optional)</span>
            <input className={styles.opsInput} name="code" placeholder="NORTH" disabled={pending} />
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add location'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

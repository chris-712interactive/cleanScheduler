'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  createTenantLocationAction,
  deleteTenantLocationAction,
  toggleTenantLocationAction,
  type LocationActionState,
} from './actions';
import styles from './locations-settings.module.scss';

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
  const activeCount = locations.filter((location) => location.is_active).length;

  return (
    <div className={styles.stack}>
      {state.error ? (
        <p className={styles.bannerError} role="alert">
          {state.error}
        </p>
      ) : null}

      <header className={styles.hero}>
        <h2 className={styles.heroTitle}>Organize crews by branch or territory</h2>
        <p className={styles.heroLead}>
          Locations are optional tags for visits and invoices. Use them when you run multiple crews
          or service areas and want to filter the schedule or reports.
        </p>
        <div className={styles.heroMeta}>
          <span className={styles.metaChip}>
            {locations.length} {locations.length === 1 ? 'location' : 'locations'}
          </span>
          <span className={styles.metaChip}>
            {activeCount} active {activeCount === 1 ? 'tag' : 'tags'}
          </span>
        </div>
      </header>

      {locations.length === 0 ? (
        <p className={styles.emptyState}>
          No locations yet. Add a branch or territory when you want to tag visits and invoices by
          crew or service area.
        </p>
      ) : (
        <ul className={styles.itemList}>
          {locations.map((location) => (
            <li key={location.id} className={styles.itemCard}>
              <div className={styles.itemMain}>
                <p className={styles.itemTitle}>{location.name}</p>
                <p className={styles.itemMeta}>
                  {location.code ? `Code: ${location.code}` : 'No short code'}
                </p>
                <StatusPill tone={location.is_active ? 'success' : 'neutral'}>
                  {location.is_active ? 'Active' : 'Inactive'}
                </StatusPill>
              </div>
              {canEdit ? (
                <div className={styles.itemActions}>
                  <form action={toggleTenantLocationAction}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="location_id" value={location.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={location.is_active ? 'false' : 'true'}
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      {location.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </form>
                  <form action={deleteTenantLocationAction}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="location_id" value={location.id} />
                    <Button type="submit" size="sm" variant="danger">
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
        <div className={styles.setupCard}>
          <p className={styles.setupTitle}>Add a location</p>
          <form action={formAction}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Location name</span>
              <span className={styles.fieldHint}>
                Something your team will recognize, like &ldquo;North county crew&rdquo;.
              </span>
              <input
                className={styles.textInput}
                name="name"
                placeholder="North county crew"
                required
                disabled={pending}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Short code (optional)</span>
              <span className={styles.fieldHint}>A brief label for reports and filters.</span>
              <input
                className={styles.textInput}
                name="code"
                placeholder="NORTH"
                disabled={pending}
              />
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add location'}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

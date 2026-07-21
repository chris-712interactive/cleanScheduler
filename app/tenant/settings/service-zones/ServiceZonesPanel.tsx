'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  createTenantServiceZoneAction,
  deleteTenantServiceZoneAction,
  renameTenantServiceZoneAction,
  toggleTenantServiceZoneAction,
  type ServiceZoneActionState,
} from './actions';
import styles from './service-zones-settings.module.scss';

const initialState: ServiceZoneActionState = {};

export function ServiceZonesPanel({
  tenantSlug,
  canEdit,
  zones,
}: {
  tenantSlug: string;
  canEdit: boolean;
  zones: Array<{
    id: string;
    name: string;
    is_active: boolean;
    sort_order: number;
  }>;
}) {
  const [createState, createAction, createPending] = useActionState(
    createTenantServiceZoneAction,
    initialState,
  );
  const [renameState, renameAction, renamePending] = useActionState(
    renameTenantServiceZoneAction,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTenantServiceZoneAction,
    initialState,
  );
  const activeCount = zones.filter((zone) => zone.is_active).length;
  const bannerError = createState.error ?? renameState.error ?? deleteState.error;
  const bannerSuccess =
    createState.success || renameState.success || deleteState.success ? 'Saved.' : null;

  return (
    <div className={styles.stack}>
      {bannerError ? (
        <p className={styles.bannerError} role="alert">
          {bannerError}
        </p>
      ) : null}
      {bannerSuccess && !bannerError ? (
        <p className={styles.bannerSuccess} role="status">
          {bannerSuccess}
        </p>
      ) : null}

      <header className={styles.hero}>
        <h2 className={styles.heroTitle}>Organize customers by community or area</h2>
        <p className={styles.heroLead}>
          Service zones are labels you assign to service locations — for example &ldquo;Babcock
          Ranch&rdquo; or &ldquo;North county&rdquo;. Search and filter the customer directory by
          zone. Separate from Locations (Pro), which tag visits and invoices by crew or branch.
        </p>
        <div className={styles.heroMeta}>
          <span className={styles.metaChip}>
            {zones.length} {zones.length === 1 ? 'zone' : 'zones'}
          </span>
          <span className={styles.metaChip}>{activeCount} active</span>
        </div>
      </header>

      {zones.length === 0 ? (
        <p className={styles.emptyState}>
          No service zones yet. Add communities or areas your team uses when organizing customers.
        </p>
      ) : (
        <ul className={styles.itemList}>
          {zones.map((zone) => (
            <li key={zone.id} className={styles.itemCard}>
              <div className={styles.itemMain}>
                <p className={styles.itemTitle}>{zone.name}</p>
                <StatusPill tone={zone.is_active ? 'success' : 'neutral'}>
                  {zone.is_active ? 'Active' : 'Inactive'}
                </StatusPill>
                {canEdit ? (
                  <form action={renameAction} className={styles.renameForm}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="zone_id" value={zone.id} />
                    <input
                      className={styles.renameInput}
                      name="name"
                      defaultValue={zone.name}
                      aria-label={`Rename ${zone.name}`}
                      required
                      disabled={renamePending}
                    />
                    <Button type="submit" size="sm" variant="secondary" disabled={renamePending}>
                      {renamePending ? 'Saving…' : 'Rename'}
                    </Button>
                  </form>
                ) : null}
              </div>
              {canEdit ? (
                <div className={styles.itemActions}>
                  <form action={toggleTenantServiceZoneAction}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="zone_id" value={zone.id} />
                    <input type="hidden" name="enabled" value={zone.is_active ? 'false' : 'true'} />
                    <Button type="submit" size="sm" variant="secondary">
                      {zone.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </form>
                  <form action={deleteAction}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="zone_id" value={zone.id} />
                    <Button type="submit" size="sm" variant="danger" disabled={deletePending}>
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
          <p className={styles.setupTitle}>Add a service zone</p>
          <form action={createAction}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Zone name</span>
              <span className={styles.fieldHint}>
                Something your team will type when searching, like &ldquo;Babcock Ranch&rdquo;.
              </span>
              <input
                className={styles.textInput}
                name="name"
                placeholder="Babcock Ranch"
                required
                disabled={createPending}
              />
            </label>
            <Button type="submit" disabled={createPending}>
              {createPending ? 'Adding…' : 'Add zone'}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

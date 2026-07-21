'use client';

import { useActionState, useEffect, useState } from 'react';
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

type ZoneRow = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

export function ServiceZonesPanel({
  tenantSlug,
  canEdit,
  zones,
}: {
  tenantSlug: string;
  canEdit: boolean;
  zones: ZoneRow[];
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addFormKey, setAddFormKey] = useState(0);

  useEffect(() => {
    if (renameState.success) {
      setEditingId(null);
    }
  }, [renameState.success]);

  useEffect(() => {
    if (createState.success) {
      setAddFormKey((key) => key + 1);
    }
  }, [createState.success]);

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

      <header className={styles.intro}>
        <p className={styles.introLead}>
          Labels for communities and areas (e.g. Babcock Ranch). Assign on a customer&rsquo;s
          service location, then search or filter the directory by zone. Different from Locations
          (Pro), which tag visits by crew or branch.
        </p>
        <p className={styles.introMeta}>
          {zones.length} {zones.length === 1 ? 'zone' : 'zones'}
          {zones.length > 0 ? ` · ${activeCount} active` : null}
        </p>
      </header>

      <section className={styles.panel} aria-label="Service zones">
        {canEdit ? (
          <form key={addFormKey} action={createAction} className={styles.addRow}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <label className={styles.addLabel} htmlFor="new_service_zone_name">
              Add zone
            </label>
            <input
              id="new_service_zone_name"
              className={styles.addInput}
              name="name"
              placeholder="e.g. Babcock Ranch"
              required
              disabled={createPending}
              autoComplete="off"
            />
            <Button type="submit" size="sm" disabled={createPending}>
              {createPending ? 'Adding…' : 'Add'}
            </Button>
          </form>
        ) : null}

        {zones.length === 0 ? (
          <p className={styles.emptyState}>
            No zones yet. Add the communities or areas your team uses when organizing customers.
          </p>
        ) : (
          <ul className={styles.zoneList}>
            {zones.map((zone) => {
              const isEditing = editingId === zone.id;

              return (
                <li
                  key={zone.id}
                  className={styles.zoneRow}
                  data-inactive={!zone.is_active || undefined}
                >
                  {isEditing && canEdit ? (
                    <form action={renameAction} className={styles.renameRow}>
                      <input type="hidden" name="tenant_slug" value={tenantSlug} />
                      <input type="hidden" name="zone_id" value={zone.id} />
                      <input
                        className={styles.renameInput}
                        name="name"
                        defaultValue={zone.name}
                        aria-label={`Rename ${zone.name}`}
                        required
                        disabled={renamePending}
                        autoFocus
                      />
                      <div className={styles.rowActions}>
                        <Button type="submit" size="sm" disabled={renamePending}>
                          {renamePending ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingId(null)}
                          disabled={renamePending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className={styles.zoneIdentity}>
                        <span className={styles.zoneName}>{zone.name}</span>
                        <StatusPill tone={zone.is_active ? 'success' : 'neutral'}>
                          {zone.is_active ? 'Active' : 'Inactive'}
                        </StatusPill>
                      </div>
                      {canEdit ? (
                        <div className={styles.rowActions}>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingId(zone.id)}
                          >
                            Rename
                          </Button>
                          <form action={toggleTenantServiceZoneAction}>
                            <input type="hidden" name="tenant_slug" value={tenantSlug} />
                            <input type="hidden" name="zone_id" value={zone.id} />
                            <input
                              type="hidden"
                              name="enabled"
                              value={zone.is_active ? 'false' : 'true'}
                            />
                            <Button type="submit" size="sm" variant="secondary">
                              {zone.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </form>
                          <form action={deleteAction}>
                            <input type="hidden" name="tenant_slug" value={tenantSlug} />
                            <input type="hidden" name="zone_id" value={zone.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="danger"
                              disabled={deletePending}
                            >
                              Delete
                            </Button>
                          </form>
                        </div>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useActionState, useCallback, useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import type { TenantBusinessSnapshot } from '@/lib/tenant/tenantBusinessSettings';
import {
  updateBrandingAction,
  uploadTenantLogoAction,
  type BusinessSettingsActionState,
} from './businessActions';
import styles from '../settings.module.scss';

const brandingInitial: BusinessSettingsActionState = {};
const logoInitial: BusinessSettingsActionState = {};

export function BrandingForm({
  tenantSlug,
  snapshot: initialSnapshot,
  readOnly,
}: {
  tenantSlug: string;
  snapshot: TenantBusinessSnapshot;
  readOnly?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [brandFormKey, setBrandFormKey] = useState(0);
  const [logoFormKey, setLogoFormKey] = useState(0);
  const [brandState, brandAction, brandPending] = useActionState(
    updateBrandingAction,
    brandingInitial,
  );
  const [logoState, logoAction, logoPending] = useActionState(uploadTenantLogoAction, logoInitial);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  const onBusinessPatch = useCallback((patch: Partial<TenantBusinessSnapshot>) => {
    setSnapshot((current) => ({ ...current, ...patch }));
    if ('brandColor' in patch) setBrandFormKey((k) => k + 1);
    if ('logoUrl' in patch) setLogoFormKey((k) => k + 1);
  }, []);

  useServerActionSnapshot(brandState.success, brandState.businessPatch, onBusinessPatch);
  useServerActionSnapshot(logoState.success, logoState.businessPatch, onBusinessPatch);

  return (
    <div className={styles.brandingStack}>
      <form key={brandFormKey} action={brandAction} className={styles.settingsForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        {brandState.error ? (
          <p className={styles.formError} role="alert">
            {brandState.error}
          </p>
        ) : null}
        {brandState.success ? (
          <p className={styles.formSuccess} role="status">
            {brandState.success}
          </p>
        ) : null}

        <label className={styles.fieldLabel} htmlFor="brand_color">
          Brand color
        </label>
        <div className={styles.colorFieldRow}>
          <span
            className={styles.colorSwatch}
            style={{ backgroundColor: snapshot.brandColor }}
            aria-hidden
          />
          <input
            id="brand_color"
            name="brand_color"
            type="text"
            className={styles.fieldInput}
            defaultValue={snapshot.brandColor}
            pattern="^#[0-9A-Fa-f]{6}$"
            disabled={readOnly}
          />
        </div>
        <p className={styles.fieldHint}>
          This color will be used for buttons, highlights, and branding elements.
        </p>

        {!readOnly ? (
          <button type="submit" className={styles.saveButton} disabled={brandPending}>
            {brandPending ? 'Saving…' : 'Save changes'}
          </button>
        ) : null}
      </form>

      <form key={logoFormKey} action={logoAction} className={styles.settingsForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        {logoState.error ? (
          <p className={styles.formError} role="alert">
            {logoState.error}
          </p>
        ) : null}
        {logoState.success ? (
          <p className={styles.formSuccess} role="status">
            {logoState.success}
          </p>
        ) : null}

        <span className={styles.fieldLabel}>Logo</span>
        {snapshot.logoUrl ? (
          <div className={styles.logoPreviewWrap}>
            <Image
              src={snapshot.logoUrl}
              alt="Current workspace logo"
              width={120}
              height={48}
              className={styles.logoPreview}
              unoptimized
            />
          </div>
        ) : null}
        {!readOnly ? (
          <label className={styles.logoDropzone}>
            <input type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" />
            <Upload size={24} aria-hidden />
            <span className={styles.logoDropzoneTitle}>Upload your logo</span>
            <span className={styles.logoDropzoneHint}>PNG, JPG or SVG (max. 2MB)</span>
            <button type="submit" className={styles.saveButton} disabled={logoPending}>
              {logoPending ? 'Uploading…' : 'Upload logo'}
            </button>
          </label>
        ) : null}
      </form>
    </div>
  );
}

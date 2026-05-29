'use client';

import Image from 'next/image';
import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Upload } from 'lucide-react';
import { submitServerActionForm } from '@/lib/forms/submitServerActionForm';
import { useServerActionSnapshot } from '@/lib/hooks/useServerActionSnapshot';
import { SettingsSaveButton } from '../SettingsSaveButton';
import type { TenantBusinessSnapshot } from '@/lib/tenant/tenantBusinessSettings';
import {
  updateBrandingAction,
  uploadTenantLogoAction,
  type BusinessSettingsActionState,
} from './businessActions';
import styles from '../settings.module.scss';

const brandingInitial: BusinessSettingsActionState = {};
const logoInitial: BusinessSettingsActionState = {};

function BrandColorForm({
  tenantSlug,
  initialBrandColor,
  readOnly,
}: {
  tenantSlug: string;
  initialBrandColor: string;
  readOnly?: boolean;
}) {
  const [savedBrandColor, setSavedBrandColor] = useState(initialBrandColor);
  const [swatchColor, setSwatchColor] = useState(initialBrandColor);
  const [state, action, pending] = useActionState(updateBrandingAction, brandingInitial);

  useEffect(() => {
    setSavedBrandColor(initialBrandColor);
    setSwatchColor(initialBrandColor);
  }, [initialBrandColor]);

  useServerActionSnapshot(
    state.success,
    state.businessPatch,
    useCallback((patch: Partial<TenantBusinessSnapshot>) => {
      if (patch.brandColor) {
        setSavedBrandColor(patch.brandColor);
        setSwatchColor(patch.brandColor);
      }
    }, []),
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    submitServerActionForm(event, action);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.settingsForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {state.error ? (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.formSuccess} role="status">
          {state.success}
        </p>
      ) : null}

      <label className={styles.fieldLabel} htmlFor="brand_color">
        Brand color
      </label>
      <div className={styles.colorFieldRow}>
        <span className={styles.colorSwatch} style={{ backgroundColor: swatchColor }} aria-hidden />
        <input
          id="brand_color"
          key={savedBrandColor}
          name="brand_color"
          type="text"
          className={styles.fieldInput}
          defaultValue={savedBrandColor}
          onInput={(event) => setSwatchColor(event.currentTarget.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
          disabled={readOnly}
        />
      </div>
      <p className={styles.fieldHint}>
        This color will be used for buttons, highlights, and branding elements.
      </p>

      {!readOnly ? <SettingsSaveButton pending={pending} /> : null}
    </form>
  );
}

function LogoUploadForm({
  tenantSlug,
  initialLogoUrl,
  readOnly,
}: {
  tenantSlug: string;
  initialLogoUrl: string | null;
  readOnly?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [state, action, pending] = useActionState(uploadTenantLogoAction, logoInitial);

  useEffect(() => {
    setLogoUrl(initialLogoUrl);
  }, [initialLogoUrl]);

  useServerActionSnapshot(
    state.success,
    state.businessPatch,
    useCallback((patch: Partial<TenantBusinessSnapshot>) => {
      if (patch.logoUrl) setLogoUrl(patch.logoUrl);
    }, []),
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    submitServerActionForm(event, action);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={styles.settingsForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {state.error ? (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.formSuccess} role="status">
          {state.success}
        </p>
      ) : null}

      <span className={styles.fieldLabel}>Logo</span>
      {logoUrl ? (
        <div className={styles.logoPreviewWrap}>
          <Image
            src={logoUrl}
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
          <SettingsSaveButton pending={pending} idleLabel="Upload logo" pendingLabel="Uploading…" />
        </label>
      ) : null}
    </form>
  );
}

export function BrandingForm({
  tenantSlug,
  snapshot,
  readOnly,
}: {
  tenantSlug: string;
  snapshot: TenantBusinessSnapshot;
  readOnly?: boolean;
}) {
  return (
    <div className={styles.brandingStack}>
      <BrandColorForm
        tenantSlug={tenantSlug}
        initialBrandColor={snapshot.brandColor}
        readOnly={readOnly}
      />
      <LogoUploadForm
        tenantSlug={tenantSlug}
        initialLogoUrl={snapshot.logoUrl}
        readOnly={readOnly}
      />
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  uploadOwnAvatarAction,
  updateOwnDisplayNameAction,
  type ProfileActionState,
} from '../profileActions';
import styles from './account-settings.module.scss';

const initial: ProfileActionState = {};

function AvatarUploadControl({
  tenantSlug,
  avatarUrl,
  initials,
}: {
  tenantSlug: string;
  avatarUrl: string | null;
  initials: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(uploadOwnAvatarAction, initial);

  function handleFileChange() {
    formRef.current?.requestSubmit();
  }

  return (
    <div className={styles.avatarControl}>
      <form ref={formRef} action={formAction} className={styles.avatarForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={72}
            height={72}
            className={styles.profileAvatarImage}
          />
        ) : (
          <div className={styles.profileAvatarPlaceholder} aria-hidden>
            {initials}
          </div>
        )}
        <label className={styles.avatarChangeLabel}>
          <input
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.hiddenFileInput}
            disabled={pending}
            onChange={handleFileChange}
          />
          {pending ? 'Uploading…' : 'Change photo'}
        </label>
      </form>
      {state.error ? (
        <p className={styles.inlineFeedback} data-tone="error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.inlineFeedback} data-tone="success" role="status">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}

export function AccountPreferencesPanel({
  tenantSlug,
  firstName,
  lastName,
  avatarUrl,
  initials,
  email,
  roleLabel,
}: {
  tenantSlug: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  initials: string;
  email: string;
  roleLabel: string;
}) {
  const [nameState, nameAction, namePending] = useActionState(updateOwnDisplayNameAction, initial);

  return (
    <section
      id="account-profile"
      className={styles.settingsSection}
      aria-labelledby="profile-heading"
    >
      <header className={styles.sectionHeader}>
        <h2 id="profile-heading" className={styles.sectionTitle}>
          Profile & appearance
        </h2>
        <p className={styles.sectionLead}>
          {email ? (
            <>
              Signed in as <strong>{email}</strong> · {roleLabel}
            </>
          ) : (
            <>How teammates see you in this workspace.</>
          )}
        </p>
      </header>

      <div className={styles.profileCard}>
        <div className={styles.profileMain}>
          <AvatarUploadControl tenantSlug={tenantSlug} avatarUrl={avatarUrl} initials={initials} />

          <form action={nameAction} className={styles.nameForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <div className={styles.nameRow}>
              <label className={styles.profileField} htmlFor="first_name">
                <span className={styles.fieldLabel}>First name</span>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  className={styles.textInput}
                  defaultValue={firstName}
                  maxLength={60}
                  autoComplete="given-name"
                  required
                />
              </label>
              <label className={styles.profileField} htmlFor="last_name">
                <span className={styles.fieldLabel}>Last name</span>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  className={styles.textInput}
                  defaultValue={lastName}
                  maxLength={60}
                  autoComplete="family-name"
                />
              </label>
            </div>
            <div className={styles.nameFormActions}>
              <Button type="submit" variant="primary" disabled={namePending}>
                {namePending ? 'Saving…' : 'Save name'}
              </Button>
              {nameState.error ? (
                <p className={styles.inlineFeedback} data-tone="error" role="alert">
                  {nameState.error}
                </p>
              ) : null}
              {nameState.success ? (
                <p className={styles.inlineFeedback} data-tone="success" role="status">
                  {nameState.success}
                </p>
              ) : null}
            </div>
          </form>
        </div>

        <div className={styles.profileDivider} aria-hidden />

        <div className={styles.themeRow}>
          <div className={styles.themeCopy}>
            <p className={styles.themeTitle}>Theme</p>
            <p className={styles.themeHint}>Light, dark, or match your device.</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </section>
  );
}

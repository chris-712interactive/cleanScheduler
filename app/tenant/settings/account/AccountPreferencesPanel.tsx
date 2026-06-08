'use client';

import Image from 'next/image';
import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  uploadOwnAvatarAction,
  updateOwnDisplayNameAction,
  type ProfileActionState,
} from '../profileActions';
import styles from './account-settings.module.scss';

const initial: ProfileActionState = {};

function ActionFeedback({ state }: { state: ProfileActionState }) {
  if (state.error) {
    return (
      <p className={styles.feedback} data-tone="error" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className={styles.feedback} data-tone="success" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}

export function AccountIdentityHero({
  tenantSlug,
  displayName,
  email,
  roleLabel,
  tenantName,
  avatarUrl,
  initials,
}: {
  tenantSlug: string;
  displayName: string;
  email: string;
  roleLabel: string;
  tenantName: string;
  avatarUrl: string | null;
  initials: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(uploadOwnAvatarAction, initial);

  return (
    <header className={styles.accountHero} aria-label="Your account">
      <form
        ref={formRef}
        action={formAction}
        className={styles.avatarControl}
        aria-label="Profile photo"
      >
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={80} height={80} className={styles.avatarImage} />
        ) : (
          <span className={styles.avatarFallback} aria-hidden>
            {initials}
          </span>
        )}
        <label className={styles.avatarChangeLabel}>
          <input
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.hiddenFileInput}
            disabled={pending}
            onChange={() => formRef.current?.requestSubmit()}
          />
          {pending ? 'Uploading…' : 'Change photo'}
        </label>
        <ActionFeedback state={state} />
      </form>

      <div className={styles.heroIdentity}>
        <h2 className={styles.heroName}>{displayName}</h2>
        {email ? <p className={styles.heroEmail}>{email}</p> : null}
        <div className={styles.heroMeta}>
          <StatusPill tone="brand">{roleLabel}</StatusPill>
          <span className={styles.workspaceChip}>{tenantName}</span>
        </div>
      </div>
    </header>
  );
}

export function AccountProfilePanel({
  tenantSlug,
  firstName,
  lastName,
}: {
  tenantSlug: string;
  firstName: string;
  lastName: string;
}) {
  const [nameState, nameAction, namePending] = useActionState(updateOwnDisplayNameAction, initial);

  return (
    <section id="account-profile" className={styles.panel} aria-labelledby="profile-heading">
      <header className={styles.panelHeader}>
        <h3 id="profile-heading" className={styles.panelTitle}>
          Profile
        </h3>
        <p className={styles.panelLead}>
          Name shown to teammates on the schedule and team directory.
        </p>
      </header>
      <form action={nameAction} className={styles.profileForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <div className={styles.nameFields}>
          <label className={styles.fieldLabel} htmlFor="first_name">
            First name
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
          <label className={styles.fieldLabel} htmlFor="last_name">
            Last name
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
        <div className={styles.formActions}>
          <Button type="submit" variant="primary" disabled={namePending}>
            {namePending ? 'Saving…' : 'Save name'}
          </Button>
          <ActionFeedback state={nameState} />
        </div>
      </form>
    </section>
  );
}

export function AccountAppearancePanel() {
  return (
    <section id="account-appearance" className={styles.panel} aria-labelledby="appearance-heading">
      <header className={styles.panelHeader}>
        <h3 id="appearance-heading" className={styles.panelTitle}>
          Appearance
        </h3>
        <p className={styles.panelLead}>Light, dark, or match your device.</p>
      </header>
      <ThemeToggle />
    </section>
  );
}

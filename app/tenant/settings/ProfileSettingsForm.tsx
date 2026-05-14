'use client';

import { useActionState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { uploadOwnAvatarAction, updateOwnDisplayNameAction, type ProfileActionState } from './profileActions';
import styles from './settings.module.scss';

const initial: ProfileActionState = {};

export function ProfileSettingsForm({
  tenantSlug,
  displayName,
  avatarUrl,
}: {
  tenantSlug: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const [nameState, nameAction, namePending] = useActionState(updateOwnDisplayNameAction, initial);
  const [avState, avAction, avPending] = useActionState(uploadOwnAvatarAction, initial);

  return (
    <div className={styles.profileGrid}>
      <div className={styles.profileAvatarCol}>
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={72} height={72} className={styles.profileAvatarImg} />
        ) : (
          <div className={styles.profileAvatarPlaceholder} aria-hidden>
            {(displayName.trim().slice(0, 2) || 'Me').toUpperCase()}
          </div>
        )}
        <form action={avAction} className={styles.profileAvatarForm}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <label className={styles.profileFile}>
            <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </label>
          <Button type="submit" variant="secondary" disabled={avPending}>
            {avPending ? 'Uploading…' : 'Update photo'}
          </Button>
        </form>
        {avState.error ? (
          <p className={styles.profileError} role="alert">
            {avState.error}
          </p>
        ) : null}
        {avState.success ? <p className={styles.profileOk}>{avState.success}</p> : null}
      </div>
      <div>
        <form action={nameAction} className={styles.profileNameForm}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <label className={styles.profileLabel} htmlFor="display_name">
            Display name
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            className={styles.profileInput}
            defaultValue={displayName}
            maxLength={120}
            required
          />
          <Button type="submit" variant="primary" disabled={namePending}>
            {namePending ? 'Saving…' : 'Save name'}
          </Button>
        </form>
        {nameState.error ? (
          <p className={styles.profileError} role="alert">
            {nameState.error}
          </p>
        ) : null}
        {nameState.success ? <p className={styles.profileOk}>{nameState.success}</p> : null}
      </div>
    </div>
  );
}

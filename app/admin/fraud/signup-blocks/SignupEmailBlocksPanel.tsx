'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  blockSignupEmailAction,
  unblockSignupEmailAction,
  type SignupEmailBlockFormState,
} from '@/lib/admin/signupEmailBlockActions';
import type { SignupEmailBlockRow } from '@/lib/admin/platformSignupEmailBlocks';
import styles from '../../tenants/tenants.module.scss';

const initialState: SignupEmailBlockFormState = {};

export function SignupEmailBlocksPanel(props: {
  blocks: SignupEmailBlockRow[];
  flash?: string | null;
}) {
  const [blockState, blockAction, blockPending] = useActionState(
    blockSignupEmailAction,
    initialState,
  );
  const [unblockState, unblockAction, unblockPending] = useActionState(
    unblockSignupEmailAction,
    initialState,
  );

  const formError = blockState.error || unblockState.error;

  return (
    <div className={styles.riskPanel}>
      {props.flash ? (
        <p className={styles.bannerSuccess} role="status">
          {props.flash}
        </p>
      ) : null}
      {formError ? (
        <p className={styles.bannerError} role="alert">
          {formError}
        </p>
      ) : null}

      <form action={blockAction} className={styles.riskForm}>
        <input type="hidden" name="return_path" value="/fraud/signup-blocks" />
        <input type="hidden" name="source" value="manual" />
        <label className={styles.riskReasonLabel} htmlFor="block-email">
          Email to block from workspace signup
        </label>
        <input
          id="block-email"
          name="email"
          type="email"
          required
          className={styles.riskReasonInput}
          placeholder="owner@example.com"
          autoComplete="off"
        />
        <label className={styles.riskReasonLabel} htmlFor="block-reason">
          Reason
        </label>
        <input
          id="block-reason"
          name="reason"
          className={styles.riskReasonInput}
          placeholder="e.g. Repeat fraud after trial purge"
          maxLength={500}
        />
        <Button type="submit" variant="danger" disabled={blockPending}>
          {blockPending ? 'Blocking…' : 'Block email'}
        </Button>
      </form>

      {props.blocks.length === 0 ? (
        <p className={styles.empty}>No blocked signup emails yet.</p>
      ) : (
        <ul className={styles.blockList}>
          {props.blocks.map((row) => (
            <li key={row.id} className={styles.blockRow}>
              <div>
                <p className={styles.monoId}>{row.emailNormalized}</p>
                <p className={styles.hint}>
                  {row.reason?.trim() || 'No reason'} · {row.source} ·{' '}
                  {new Date(row.createdAt).toLocaleString()}
                  {row.sourceTenantSlug ? ` · from ${row.sourceTenantSlug}` : ''}
                </p>
              </div>
              <form action={unblockAction}>
                <input type="hidden" name="return_path" value="/fraud/signup-blocks" />
                <input type="hidden" name="email" value={row.emailNormalized} />
                <Button type="submit" variant="secondary" disabled={unblockPending}>
                  Unblock
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

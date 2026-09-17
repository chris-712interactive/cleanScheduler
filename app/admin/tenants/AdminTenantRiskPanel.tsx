'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  freezeTenantConnectChargesAction,
  suspendTenantAccessAction,
  unfreezeTenantConnectChargesAction,
  unsuspendTenantAccessAction,
  type AdminTenantRiskFormState,
} from '@/lib/admin/tenantRiskActions';
import {
  blockSignupEmailAction,
  unblockSignupEmailAction,
  type SignupEmailBlockFormState,
} from '@/lib/admin/signupEmailBlockActions';
import styles from './tenants.module.scss';

export interface AdminTenantRiskPanelProps {
  tenantId: string;
  tenantSlug: string;
  ownerEmail: string | null;
  ownerEmailBlocked: boolean;
  adminAccessSuspendedAt: string | null;
  adminAccessSuspendedReason: string | null;
  connectChargesFrozenAt: string | null;
  connectChargesFrozenReason: string | null;
  stripeConnectStatus: string;
  stripeConnectAccountId: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  recentDisputeCount: number;
  recentVelocityBlockCount: number;
}

const initialState: AdminTenantRiskFormState = {};
const emailBlockInitial: SignupEmailBlockFormState = {};

export function AdminTenantRiskPanel(props: AdminTenantRiskPanelProps) {
  const [suspendState, suspendAction, suspendPending] = useActionState(
    suspendTenantAccessAction,
    initialState,
  );
  const [unsuspendState, unsuspendAction, unsuspendPending] = useActionState(
    unsuspendTenantAccessAction,
    initialState,
  );
  const [freezeState, freezeAction, freezePending] = useActionState(
    freezeTenantConnectChargesAction,
    initialState,
  );
  const [unfreezeState, unfreezeAction, unfreezePending] = useActionState(
    unfreezeTenantConnectChargesAction,
    initialState,
  );
  const [blockEmailState, blockEmailAction, blockEmailPending] = useActionState(
    blockSignupEmailAction,
    emailBlockInitial,
  );
  const [unblockEmailState, unblockEmailAction, unblockEmailPending] = useActionState(
    unblockSignupEmailAction,
    emailBlockInitial,
  );

  const accessSuspended = Boolean(props.adminAccessSuspendedAt);
  const connectFrozen = Boolean(props.connectChargesFrozenAt);
  const ownerEmail = props.ownerEmail?.trim() || null;
  const formError =
    suspendState.error ||
    unsuspendState.error ||
    freezeState.error ||
    unfreezeState.error ||
    blockEmailState.error ||
    unblockEmailState.error;

  return (
    <div className={styles.riskPanel}>
      <div className={styles.riskStatusRow}>
        <div>
          <p className={styles.riskLabel}>Portal access</p>
          <StatusPill tone={accessSuspended ? 'danger' : 'success'}>
            {accessSuspended ? 'Suspended' : 'Open'}
          </StatusPill>
          {accessSuspended && props.adminAccessSuspendedReason ? (
            <p className={styles.hint}>{props.adminAccessSuspendedReason}</p>
          ) : null}
          {accessSuspended && props.adminAccessSuspendedAt ? (
            <p className={styles.hintMuted}>
              Since {new Date(props.adminAccessSuspendedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div>
          <p className={styles.riskLabel}>Connect charges</p>
          <StatusPill tone={connectFrozen ? 'danger' : 'success'}>
            {connectFrozen ? 'Frozen' : 'Allowed'}
          </StatusPill>
          {connectFrozen && props.connectChargesFrozenReason ? (
            <p className={styles.hint}>{props.connectChargesFrozenReason}</p>
          ) : null}
          {connectFrozen && props.connectChargesFrozenAt ? (
            <p className={styles.hintMuted}>
              Since {new Date(props.connectChargesFrozenAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div>
          <p className={styles.riskLabel}>Owner signup email</p>
          <StatusPill tone={props.ownerEmailBlocked ? 'danger' : 'success'}>
            {props.ownerEmailBlocked ? 'Blocked' : 'Allowed'}
          </StatusPill>
          {ownerEmail ? <p className={styles.hintMuted}>{ownerEmail}</p> : null}
          <p className={styles.hintMuted}>Survives tenant purge</p>
        </div>
      </div>

      <dl className={styles.riskMetaList}>
        <div>
          <dt>Connect account</dt>
          <dd className={styles.monoId}>{props.stripeConnectAccountId ?? '—'}</dd>
        </div>
        <div>
          <dt>Stripe Connect status</dt>
          <dd>{props.stripeConnectStatus}</dd>
        </div>
        <div>
          <dt>Charges enabled</dt>
          <dd>{props.chargesEnabled == null ? '—' : props.chargesEnabled ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Payouts enabled</dt>
          <dd>{props.payoutsEnabled == null ? '—' : props.payoutsEnabled ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Disputes (30d)</dt>
          <dd>{props.recentDisputeCount}</dd>
        </div>
        <div>
          <dt>Velocity blocks (7d)</dt>
          <dd>{props.recentVelocityBlockCount}</dd>
        </div>
      </dl>

      {formError ? (
        <p className={styles.bannerError} role="alert">
          {formError}
        </p>
      ) : null}

      <div className={styles.riskActions}>
        {accessSuspended ? (
          <form action={unsuspendAction}>
            <input type="hidden" name="tenant_id" value={props.tenantId} />
            <input type="hidden" name="tenant_slug" value={props.tenantSlug} />
            <Button type="submit" variant="secondary" disabled={unsuspendPending}>
              {unsuspendPending ? 'Restoring…' : 'Restore portal access'}
            </Button>
          </form>
        ) : (
          <form action={suspendAction} className={styles.riskForm}>
            <input type="hidden" name="tenant_id" value={props.tenantId} />
            <input type="hidden" name="tenant_slug" value={props.tenantSlug} />
            <label className={styles.riskReasonLabel} htmlFor="suspend-reason">
              Suspend reason
            </label>
            <input
              id="suspend-reason"
              name="reason"
              className={styles.riskReasonInput}
              placeholder="e.g. Suspected stolen-card Connect abuse"
              maxLength={500}
            />
            <Button type="submit" variant="danger" disabled={suspendPending}>
              {suspendPending ? 'Suspending…' : 'Suspend portal access'}
            </Button>
          </form>
        )}

        {connectFrozen ? (
          <form action={unfreezeAction}>
            <input type="hidden" name="tenant_id" value={props.tenantId} />
            <input type="hidden" name="tenant_slug" value={props.tenantSlug} />
            <Button type="submit" variant="secondary" disabled={unfreezePending}>
              {unfreezePending ? 'Unfreezing…' : 'Unfreeze Connect charges'}
            </Button>
          </form>
        ) : (
          <form action={freezeAction} className={styles.riskForm}>
            <input type="hidden" name="tenant_id" value={props.tenantId} />
            <input type="hidden" name="tenant_slug" value={props.tenantSlug} />
            <label className={styles.riskReasonLabel} htmlFor="freeze-reason">
              Freeze reason
            </label>
            <input
              id="freeze-reason"
              name="reason"
              className={styles.riskReasonInput}
              placeholder="e.g. Velocity burst / dispute spike"
              maxLength={500}
            />
            <Button type="submit" variant="danger" disabled={freezePending}>
              {freezePending ? 'Freezing…' : 'Freeze Connect charges'}
            </Button>
          </form>
        )}

        {ownerEmail ? (
          props.ownerEmailBlocked ? (
            <form action={unblockEmailAction}>
              <input type="hidden" name="return_path" value={`/tenants/${props.tenantSlug}`} />
              <input type="hidden" name="email" value={ownerEmail} />
              <Button type="submit" variant="secondary" disabled={unblockEmailPending}>
                {unblockEmailPending ? 'Unblocking…' : 'Unblock owner email for signup'}
              </Button>
            </form>
          ) : (
            <form action={blockEmailAction} className={styles.riskForm}>
              <input type="hidden" name="return_path" value={`/tenants/${props.tenantSlug}`} />
              <input type="hidden" name="email" value={ownerEmail} />
              <input type="hidden" name="tenant_id" value={props.tenantId} />
              <input type="hidden" name="tenant_slug" value={props.tenantSlug} />
              <input type="hidden" name="source" value="admin_tenant" />
              <label className={styles.riskReasonLabel} htmlFor="block-owner-reason">
                Block owner email from future signups
              </label>
              <input
                id="block-owner-reason"
                name="reason"
                className={styles.riskReasonInput}
                placeholder="e.g. Fraud — ban before purge"
                maxLength={500}
              />
              <Button type="submit" variant="danger" disabled={blockEmailPending}>
                {blockEmailPending ? 'Blocking…' : 'Block owner email'}
              </Button>
            </form>
          )
        ) : (
          <p className={styles.hintMuted}>
            No owner email on file — add a block under Fraud → Signup email blocks.
          </p>
        )}
      </div>
    </div>
  );
}

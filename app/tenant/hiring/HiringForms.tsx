'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import {
  addSlotAction,
  applicationAction,
  closeOpeningAction,
  createOpeningAction,
  emailApplyLinkAction,
  saveOpeningAction,
  type HiringActionState,
} from './actions';
import styles from './hiring.module.scss';

const initial: HiringActionState = {};

function useHiringForm(
  action: (prev: HiringActionState, formData: FormData) => Promise<HiringActionState>,
) {
  const [state, formAction, pending] = useActionState(action, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });
  return { formAction, pending, state };
}

export function CreateOpeningForm() {
  const { formAction, pending } = useHiringForm(createOpeningAction);
  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.field}>
        <span>Title</span>
        <input name="title" className={styles.input} required placeholder="Weekend cleaner" />
      </label>
      <label className={styles.field}>
        <span>Kind</span>
        <select name="kind" className={styles.select} defaultValue="field">
          <option value="field">Field — cleaner</option>
          <option value="office">Office</option>
        </select>
      </label>
      <p className={styles.note}>
        This company is the employer. Clean Scheduler does not place workers or take a placement
        fee.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create draft'}
      </Button>
    </form>
  );
}

export function OpeningEditor({
  opening,
}: {
  opening: {
    id: string;
    title: string;
    slug: string;
    kind: string;
    status: string;
    payText: string;
    scheduleText: string;
    areaText: string;
    interviewKind: string;
    confirmWindowMinutes: number;
    requireTransportation: boolean;
    requireAcceptsPay: boolean;
    requireAcceptsSchedule: boolean;
    requireBackgroundCheck: boolean;
    requireWorkAuthorized: boolean;
  };
}) {
  const { formAction, pending } = useHiringForm(saveOpeningAction);
  const lockedSlug = opening.status !== 'draft';
  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="opening_id" value={opening.id} />
      <label className={styles.field}>
        <span>Title</span>
        <input name="title" className={styles.input} required defaultValue={opening.title} />
      </label>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Kind</span>
          <select name="kind" className={styles.select} defaultValue={opening.kind}>
            <option value="field">Field</option>
            <option value="office">Office</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Interview</span>
          <select
            name="interview_kind"
            className={styles.select}
            defaultValue={opening.interviewKind}
          >
            <option value="phone">Phone call</option>
            <option value="office">In the office</option>
            <option value="paid_shadow">Paid shadow</option>
          </select>
        </label>
      </div>
      <label className={styles.field}>
        <span>Pay shown to applicants</span>
        <input
          name="pay_text"
          className={styles.input}
          defaultValue={opening.payText}
          placeholder="$18–$22/hour to start"
        />
      </label>
      <label className={styles.field}>
        <span>Days and hours</span>
        <input
          name="schedule_text"
          className={styles.input}
          defaultValue={opening.scheduleText}
          placeholder="Weekdays, 8:00–3:00"
        />
      </label>
      <label className={styles.field}>
        <span>City or area</span>
        <input
          name="area_text"
          className={styles.input}
          defaultValue={opening.areaText}
          placeholder="Palm Bay"
        />
      </label>
      <label className={styles.field}>
        <span>Link name</span>
        <input
          name="slug"
          className={styles.input}
          defaultValue={opening.slug}
          readOnly={lockedSlug}
        />
      </label>
      <label className={styles.field}>
        <span>Hours they have to confirm</span>
        <input
          name="confirm_window_minutes"
          type="number"
          min={30}
          max={1440}
          className={styles.input}
          defaultValue={opening.confirmWindowMinutes}
        />
      </label>
      <fieldset className={styles.checks}>
        <legend>Questions</legend>
        <Check
          name="require_transportation"
          label="Reliable transportation"
          defaultChecked={opening.requireTransportation}
        />
        <Check
          name="require_accepts_pay"
          label="Accepts the posted pay"
          defaultChecked={opening.requireAcceptsPay}
        />
        <Check
          name="require_accepts_schedule"
          label="Can work the posted days"
          defaultChecked={opening.requireAcceptsSchedule}
        />
        <Check
          name="require_background_check_willing"
          label="Willing to do a background check"
          defaultChecked={opening.requireBackgroundCheck}
        />
        <Check
          name="require_work_authorized"
          label="Authorized to work in the United States"
          defaultChecked={opening.requireWorkAuthorized}
        />
        <p className={styles.note}>
          Age 18 or older is always asked. You cannot add your own screening questions.
        </p>
      </fieldset>
      <div className={styles.actions}>
        <Button type="submit" name="publish" value="0" variant="secondary" disabled={pending}>
          Save
        </Button>
        {opening.status !== 'open' ? (
          <Button type="submit" name="publish" value="1" disabled={pending}>
            {pending ? 'Saving…' : 'Open the link'}
          </Button>
        ) : (
          <Button type="submit" name="publish" value="1" disabled={pending}>
            Save and keep live
          </Button>
        )}
      </div>
    </form>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className={styles.check}>
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}

export function CloseOpeningForm({ openingId }: { openingId: string }) {
  const { formAction, pending } = useHiringForm(closeOpeningAction);
  return (
    <form action={formAction}>
      <input type="hidden" name="opening_id" value={openingId} />
      <Button type="submit" variant="danger" disabled={pending}>
        Close opening
      </Button>
    </form>
  );
}

export function AddSlotForm({ openingId }: { openingId: string }) {
  const { formAction, pending } = useHiringForm(addSlotAction);
  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="opening_id" value={openingId} />
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Date</span>
          <input name="slot_date" type="date" className={styles.input} required />
        </label>
        <label className={styles.field}>
          <span>Time</span>
          <input name="slot_time" type="time" className={styles.input} required />
        </label>
        <label className={styles.field}>
          <span>Minutes</span>
          <input
            name="duration_minutes"
            type="number"
            min={15}
            max={480}
            defaultValue={60}
            className={styles.input}
          />
        </label>
      </div>
      <label className={styles.field}>
        <span>Where they should go, or the number that will call</span>
        <input
          name="meeting_text"
          className={styles.input}
          required
          placeholder="Meet at the shop, 14 Oak St. Do not put a customer address here."
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? 'Publishing…' : 'Publish slot'}
      </Button>
    </form>
  );
}

export function EmailApplyLinkForm({ openingId }: { openingId: string }) {
  const { formAction, pending } = useHiringForm(emailApplyLinkAction);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="opening_id" value={openingId} />
      <input
        name="email"
        type="email"
        required
        placeholder="Email the application link"
        className={styles.input}
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        Send link
      </Button>
    </form>
  );
}

export function ApplicationButtons({
  openingId,
  applicationId,
  status,
  canHire,
}: {
  openingId: string;
  applicationId: string;
  status: string;
  canHire: boolean;
}) {
  const { formAction, pending } = useHiringForm(applicationAction);
  const button = (
    intent: string,
    label: string,
    variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'secondary',
  ) => (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={variant}
      size="sm"
      disabled={pending}
    >
      {label}
    </Button>
  );
  return (
    <form action={formAction} className={styles.queueActions}>
      <input type="hidden" name="opening_id" value={openingId} />
      <input type="hidden" name="application_id" value={applicationId} />
      {status === 'screened_out' ? button('override', 'Move forward') : null}
      {status === 'slot_offered' ? button('resend', 'Resend confirm') : null}
      {status === 'slot_offered' || status === 'confirmed' ? button('cancel', 'Cancel time') : null}
      {status !== 'hired' && status !== 'withdrawn' ? button('showed', 'Showed', 'primary') : null}
      {status !== 'hired' && status !== 'withdrawn' ? button('no_show', 'No-show') : null}
      {status !== 'hired' && status !== 'withdrawn' ? button('rejected', 'Not a fit') : null}
      {status === 'showed' && canHire ? button('hire', 'Hire', 'primary') : null}
      {status !== 'withdrawn' ? button('delete', 'Delete data', 'danger') : null}
    </form>
  );
}

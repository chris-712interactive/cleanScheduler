'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import {
  updateEmployeeHoursPolicyAction,
  type EmployeeHoursPolicyActionState,
} from './employeeHoursPolicyActions';
import styles from './operations-settings.module.scss';

const initial: EmployeeHoursPolicyActionState = {};

export function EmployeeHoursPolicyForm({
  tenantSlug,
  employeesCanEditOwnHours,
  employeeHoursRequireApproval,
  readOnly = false,
}: {
  tenantSlug: string;
  employeesCanEditOwnHours: boolean;
  employeeHoursRequireApproval: boolean;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateEmployeeHoursPolicyAction, initial);
  useFeedbackToast({
    error: state.error,
    success: state.success ? 'Employee hour settings saved.' : undefined,
    pending,
  });

  return (
    <form action={formAction} className={styles.opsStack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <div>
        <h2 className={styles.sectionTitle}>Employee hours</h2>
        <p className={styles.sectionLead}>
          These switches apply to field employees. An owner or admin can still set hours on an
          employee record, and those hours take effect immediately.
        </p>
        <div className={styles.hoursToggles}>
          <label className={styles.notifyToggle}>
            <input
              type="checkbox"
              name="employee_hours_require_approval"
              defaultChecked={employeeHoursRequireApproval}
              disabled={readOnly || pending}
            />
            Require approval before a field employee&apos;s hour change affects the schedule
          </label>
          <label className={styles.notifyToggle}>
            <input
              type="checkbox"
              name="employees_can_edit_own_hours"
              defaultChecked={employeesCanEditOwnHours}
              disabled={readOnly || pending}
            />
            Field employees can change their own hours
          </label>
        </div>
      </div>
      {!readOnly ? (
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save employee hours'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

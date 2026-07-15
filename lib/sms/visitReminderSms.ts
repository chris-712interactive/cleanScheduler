import { sendVisitRemindersForAllTenants } from '@/lib/schedule/visitReminders';

/** @deprecated Prefer {@link sendVisitRemindersForAllTenants}. */
export async function sendVisitReminderSmsForAllTenants(): Promise<{
  tenantsChecked: number;
  remindersSent: number;
  skipped: number;
  errors: string[];
}> {
  const result = await sendVisitRemindersForAllTenants();
  return {
    tenantsChecked: result.tenantsChecked,
    remindersSent: result.smsSent,
    skipped: result.skipped,
    errors: result.errors,
  };
}

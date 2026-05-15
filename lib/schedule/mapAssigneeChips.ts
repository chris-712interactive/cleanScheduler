import {
  firstNameFromDisplayName,
  initialsFromDisplayName,
} from '@/lib/profile/displayName';
import type { ScheduleAssigneeChip } from './assigneeDisplay';

export type RawScheduleAssigneeRow = {
  user_id: string;
  user_profiles: { display_name: string | null; avatar_url?: string | null } | null;
};

export function normalizeAssigneeRows(
  raw: RawScheduleAssigneeRow | RawScheduleAssigneeRow[] | null | undefined,
): ScheduleAssigneeChip[] {
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return rows.map((a) => {
    const displayName = a.user_profiles?.display_name?.trim() || 'Member';
    return {
      userId: a.user_id,
      displayName,
      firstName: firstNameFromDisplayName(displayName),
      initials: initialsFromDisplayName(displayName),
      avatarUrl: a.user_profiles?.avatar_url?.trim() || null,
    };
  });
}

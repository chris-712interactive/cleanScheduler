import type { PermissionKey } from '@/lib/tenant/permissionCatalog';

export type PermissionAreaId =
  | 'quotes'
  | 'customers'
  | 'schedule'
  | 'billing'
  | 'messages'
  | 'reports'
  | 'campaigns'
  | 'team'
  | 'settings';

export interface PermissionCapability {
  key: PermissionKey;
  label: string;
  /** Shorter phrase used when summarizing partial access. */
  shortLabel: string;
  /** Other keys that must be enabled when this one is on. */
  requires?: readonly PermissionKey[];
}

export interface PermissionAreaDefinition {
  id: PermissionAreaId;
  title: string;
  description: string;
  /** Plain-language summary when every capability in the area is granted. */
  fullAccessSummary: string;
  capabilities: readonly PermissionCapability[];
}

export interface PermissionAreaSummary {
  id: PermissionAreaId;
  title: string;
  summary: string;
  level: 'partial' | 'full';
}

export const PERMISSION_AREA_DEFINITIONS: readonly PermissionAreaDefinition[] = [
  {
    id: 'quotes',
    title: 'Quotes',
    description: 'Quote board, drafts, and pipeline.',
    fullAccessSummary: 'Create, send, and manage quotes',
    capabilities: [
      { key: 'quotes.view', label: 'View quotes', shortLabel: 'View only' },
      {
        key: 'quotes.manage',
        label: 'Manage quotes',
        shortLabel: 'Manage quotes',
        requires: ['quotes.view'],
      },
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    description: 'Customer records, properties, and portal access.',
    fullAccessSummary: 'View and manage customers',
    capabilities: [
      { key: 'customers.view', label: 'View customers', shortLabel: 'View only' },
      {
        key: 'customers.manage',
        label: 'Manage customers',
        shortLabel: 'Manage customers',
        requires: ['customers.view'],
      },
    ],
  },
  {
    id: 'schedule',
    title: 'Schedule',
    description: 'Visits, calendar, and crew assignments.',
    fullAccessSummary: 'View and manage the schedule',
    capabilities: [
      { key: 'schedule.view', label: 'View schedule', shortLabel: 'View only' },
      {
        key: 'schedule.manage',
        label: 'Manage schedule',
        shortLabel: 'Manage schedule',
        requires: ['schedule.view'],
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    description: 'Invoices, payments, and Stripe setup.',
    fullAccessSummary: 'View and manage billing',
    capabilities: [
      { key: 'billing.view', label: 'View billing', shortLabel: 'View only' },
      {
        key: 'billing.manage',
        label: 'Manage billing',
        shortLabel: 'Manage billing',
        requires: ['billing.view'],
      },
    ],
  },
  {
    id: 'messages',
    title: 'Support inbox',
    description: 'Customer support threads and replies.',
    fullAccessSummary: 'View and reply to support messages',
    capabilities: [
      { key: 'messages.view', label: 'View inbox', shortLabel: 'View only' },
      {
        key: 'messages.reply',
        label: 'Reply to customers',
        shortLabel: 'Reply to customers',
        requires: ['messages.view'],
      },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Business analytics and exports.',
    fullAccessSummary: 'View and export reports',
    capabilities: [
      { key: 'reports.view', label: 'View reports', shortLabel: 'View only' },
      {
        key: 'reports.export',
        label: 'Export reports',
        shortLabel: 'Export reports',
        requires: ['reports.view'],
      },
    ],
  },
  {
    id: 'campaigns',
    title: 'Email campaigns',
    description: 'Marketing email performance and sends.',
    fullAccessSummary: 'View and manage campaigns',
    capabilities: [
      { key: 'campaigns.view', label: 'View campaigns', shortLabel: 'View only' },
      {
        key: 'campaigns.manage',
        label: 'Manage campaigns',
        shortLabel: 'Manage campaigns',
        requires: ['campaigns.view'],
      },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    description: 'Directory, invites, members, and custom roles.',
    fullAccessSummary: 'Full team administration',
    capabilities: [
      { key: 'team.view', label: 'View team directory', shortLabel: 'View directory' },
      {
        key: 'team.invite',
        label: 'Invite members',
        shortLabel: 'Invite members',
        requires: ['team.view'],
      },
      {
        key: 'team.manage_members',
        label: 'Manage members',
        shortLabel: 'Manage members',
        requires: ['team.view'],
      },
      {
        key: 'team.manage_roles',
        label: 'Manage roles & permissions',
        shortLabel: 'Manage roles',
        requires: ['team.view', 'team.manage_members'],
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Workspace configuration pages.',
    fullAccessSummary: 'Full settings access',
    capabilities: [
      { key: 'settings.view', label: 'Open settings', shortLabel: 'View settings' },
      {
        key: 'settings.operations',
        label: 'Operations settings',
        shortLabel: 'Operations settings',
        requires: ['settings.view'],
      },
      {
        key: 'settings.business',
        label: 'Business profile settings',
        shortLabel: 'Business settings',
        requires: ['settings.view'],
      },
    ],
  },
] as const;

export function permissionAreaDefinition(
  id: PermissionAreaId,
): PermissionAreaDefinition | undefined {
  return PERMISSION_AREA_DEFINITIONS.find((area) => area.id === id);
}

function capabilityKeys(area: PermissionAreaDefinition): PermissionKey[] {
  return area.capabilities.map((cap) => cap.key);
}

function summarizeTwoTierArea(
  area: PermissionAreaDefinition,
  selected: ReadonlySet<PermissionKey>,
): PermissionAreaSummary | null {
  const viewCap = area.capabilities[0];
  const manageCap = area.capabilities[1];
  if (!viewCap || !manageCap) return null;

  const hasView = selected.has(viewCap.key);
  const hasManage = selected.has(manageCap.key);

  if (!hasView && !hasManage) return null;
  if (hasView && hasManage) {
    return { id: area.id, title: area.title, summary: area.fullAccessSummary, level: 'full' };
  }
  if (hasView) {
    return { id: area.id, title: area.title, summary: 'View only', level: 'partial' };
  }
  return {
    id: area.id,
    title: area.title,
    summary: manageCap.shortLabel,
    level: 'partial',
  };
}

function summarizeMultiCapabilityArea(
  area: PermissionAreaDefinition,
  selected: ReadonlySet<PermissionKey>,
): PermissionAreaSummary | null {
  const enabled = area.capabilities.filter((cap) => selected.has(cap.key));
  if (enabled.length === 0) return null;

  if (enabled.length === area.capabilities.length) {
    return { id: area.id, title: area.title, summary: area.fullAccessSummary, level: 'full' };
  }

  return {
    id: area.id,
    title: area.title,
    summary: enabled.map((cap) => cap.shortLabel).join(' · '),
    level: 'partial',
  };
}

/** Short label for browse UI — avoids long sentences in tight layouts. */
export function compactAccessLabel(entry: PermissionAreaSummary): string {
  if (entry.level === 'full') return 'Full';
  if (entry.summary === 'View only') return 'View';
  return entry.summary;
}

/** Human-readable access summary grouped by product area. */
export function summarizePermissionAreas(
  permissions: Iterable<PermissionKey>,
): PermissionAreaSummary[] {
  const selected = new Set(permissions);
  const summaries: PermissionAreaSummary[] = [];

  for (const area of PERMISSION_AREA_DEFINITIONS) {
    const enabledCount = area.capabilities.filter((cap) => selected.has(cap.key)).length;
    if (enabledCount === 0) continue;

    const summary =
      area.capabilities.length === 2
        ? summarizeTwoTierArea(area, selected)
        : summarizeMultiCapabilityArea(area, selected);

    if (summary) summaries.push(summary);
  }

  return summaries;
}

export type PermissionAreaPreset = 'none' | 'view' | 'full';

/** Preset access levels for two-capability areas (view + manage). */
export function permissionAreaPreset(
  area: PermissionAreaDefinition,
  selected: ReadonlySet<PermissionKey>,
): PermissionAreaPreset {
  const keys = capabilityKeys(area);
  const enabled = keys.filter((key) => selected.has(key));

  if (enabled.length === 0) return 'none';
  if (enabled.length === keys.length) return 'full';

  const viewKey = keys[0];
  if (enabled.length === 1 && viewKey && selected.has(viewKey)) return 'view';
  return 'view';
}

export function applyPermissionAreaPreset(
  area: PermissionAreaDefinition,
  preset: PermissionAreaPreset,
  selected: ReadonlySet<PermissionKey>,
): Set<PermissionKey> {
  const next = new Set(selected);
  const keys = capabilityKeys(area);
  for (const key of keys) {
    next.delete(key);
  }

  if (preset === 'none') return next;

  const viewKey = keys[0];
  const manageKey = keys[1];
  if (!viewKey) return next;

  next.add(viewKey);
  if (preset === 'full' && manageKey) {
    next.add(manageKey);
  }

  return next;
}

export function togglePermissionCapability(
  capability: PermissionCapability,
  enabled: boolean,
  selected: ReadonlySet<PermissionKey>,
): Set<PermissionKey> {
  const next = new Set(selected);

  if (enabled) {
    for (const required of capability.requires ?? []) {
      next.add(required);
    }
    next.add(capability.key);
    return next;
  }

  next.delete(capability.key);
  for (const area of PERMISSION_AREA_DEFINITIONS) {
    for (const cap of area.capabilities) {
      if (cap.requires?.includes(capability.key) && next.has(cap.key)) {
        next.delete(cap.key);
      }
    }
  }

  return next;
}

export function isTwoTierPermissionArea(area: PermissionAreaDefinition): boolean {
  return area.capabilities.length === 2;
}

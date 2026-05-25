import type { NavItem } from '@/components/portal/types';
import type { TenantRole } from '@/lib/auth/types';
import { resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { getOwnerOnboardingChecklist } from '@/lib/tenant/ownerOnboardingChecklist';
import { shouldShowGettingStartedNav } from '@/lib/tenant/ownerOnboardingState';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface OwnerOnboardingNavContext {
  gettingStartedNavItem: NavItem | null;
}

export async function loadOwnerOnboardingNavContext(params: {
  db: SupabaseClient<Database>;
  admin: SupabaseClient<Database>;
  tenantId: string;
  tenantSlug: string;
  role: TenantRole;
  connectStatus: string | null | undefined;
}): Promise<OwnerOnboardingNavContext> {
  if (!canManageTeamInvitesAndRoles(params.role)) {
    return { gettingStartedNavItem: null };
  }

  const entitlementPlan = await resolveTenantEntitlementPlan(params.admin, params.tenantId);
  const checklist = await getOwnerOnboardingChecklist(params.db, params.admin, {
    tenantId: params.tenantId,
    connectStatus: params.connectStatus,
    entitlementPlan,
  });

  if (
    !shouldShowGettingStartedNav(checklist.uiState, checklist.incompleteRequiredCount)
  ) {
    return { gettingStartedNavItem: null };
  }

  const badge =
    checklist.incompleteRequiredCount > 99 ? '99+' : checklist.incompleteRequiredCount;

  return {
    gettingStartedNavItem: {
      label: 'Getting started',
      href: '/getting-started',
      icon: 'gettingStarted',
      badge,
    },
  };
}

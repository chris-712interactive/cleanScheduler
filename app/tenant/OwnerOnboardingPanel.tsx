import { Card } from '@/components/ui/Card';
import type { OwnerOnboardingChecklist } from '@/lib/tenant/ownerOnboardingChecklist';
import { shouldShowDashboardChecklistCard } from '@/lib/tenant/ownerOnboardingState';
import { OwnerOnboardingChecklistView } from './OwnerOnboardingChecklistView';

export function OwnerOnboardingPanel({
  tenantSlug,
  checklist,
}: {
  tenantSlug: string;
  checklist: OwnerOnboardingChecklist;
}) {
  if (!shouldShowDashboardChecklistCard(checklist.uiState)) {
    return null;
  }

  return (
    <Card
      title="Getting started"
      titleHint={`${checklist.completedCount} of ${checklist.totalRequired} required steps complete`}
      description="Finish these basics so quotes, scheduling, and billing flow smoothly."
    >
      <OwnerOnboardingChecklistView
        tenantSlug={tenantSlug}
        checklist={checklist}
        variant="card"
      />
    </Card>
  );
}

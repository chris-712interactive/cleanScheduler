import { Building2, Home, KeyRound, Shapes } from 'lucide-react';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { PROPERTY_KIND_LABEL } from '@/lib/tenant/propertyKindLabels';
import { propertyKindFamily } from '@/lib/tenant/serviceSegment';
import styles from './PropertyKindBadge.module.scss';

const ICONS = {
  residential: Home,
  commercial: Building2,
  short_term_rental: KeyRound,
  other: Shapes,
} as const;

export function PropertyKindBadge({
  kind,
  compact = false,
}: {
  kind: CustomerPropertyKind;
  compact?: boolean;
}) {
  const Icon = ICONS[kind];
  const family = propertyKindFamily(kind);
  return (
    <span className={styles.badge} data-family={family} data-kind={kind}>
      <Icon size={compact ? 12 : 14} aria-hidden />
      <span>{PROPERTY_KIND_LABEL[kind]}</span>
    </span>
  );
}

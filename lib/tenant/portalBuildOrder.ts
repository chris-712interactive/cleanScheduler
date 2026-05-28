/**
 * Canonical order for implementing net-new tenant-portal features (after Dashboard):
 * quotes → customers → schedule. Nav order and onboarding CTAs follow this pipeline.
 */
export const TENANT_PORTAL_FEATURE_ORDER = ['quotes', 'customers', 'schedule'] as const;

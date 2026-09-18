-- =============================================================================
-- 0091_platform_sales_role.sql
-- Platform sales closer role. Value is used in 0092 (Postgres cannot use a
-- newly added enum value in the same transaction on some versions).
-- =============================================================================

alter type public.app_role add value if not exists 'sales';

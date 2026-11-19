export class LocalOnlyUrlError extends Error {}

export function assertLocalDatabaseUrl(raw: string): void;

export function assertLocalSupabaseUrl(raw: string): void;

export function assertLocalStackEnv(env: {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  DATABASE_URL?: string;
}): void;

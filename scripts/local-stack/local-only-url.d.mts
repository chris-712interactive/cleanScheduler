export class LocalOnlyUrlError extends Error {}

export function assertLocalDatabaseUrl(raw: string): void;

export function assertLocalSupabaseUrl(raw: string): void;

export function assertLocalStackEnv(env: {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  DATABASE_URL?: string;
}): void;

export function localStackPgPort(raw?: string): string;

export function localPgTarget(raw: string): {
  host: '127.0.0.1' | '::1';
  port: string;
  user: string;
  database: string;
  password: string;
};

export function localPsqlArgs(
  target: { host: string; port: string; user: string; database: string },
  extra?: string[],
): string[];

export function assertPgArgv(args: string[]): void;

export function libpqChildEnv(
  env: Record<string, string | undefined>,
  options?: { password?: string },
): Record<string, string | undefined>;

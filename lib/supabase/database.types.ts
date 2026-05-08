/**
 * Placeholder until we run `supabase gen types typescript` against the live
 * schema. The first migration will replace this with the real generated
 * types; until then the empty schema lets the typed client import compile.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

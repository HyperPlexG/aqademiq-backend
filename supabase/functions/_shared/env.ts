// Env access for Edge Functions. Deno.env only — no process.env.
// Some platform values (SUPABASE_URL, SUPABASE_DB_URL) are auto-injected.

export function env(name: string): string | undefined {
  return Deno.env.get(name);
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is required`);
  return v;
}

/** Transaction-pooler URL for Prisma. Prefers DATABASE_URL, falls back to the
 *  platform-injected SUPABASE_DB_URL (session pooler) so the function still runs
 *  before the pooled URL secret is set. */
export function databaseUrl(): string {
  const url = Deno.env.get('DATABASE_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!url) throw new Error('DATABASE_URL (or SUPABASE_DB_URL) is required');
  return url;
}

// Phase-1 spike: prove Postgres access from inside a Supabase Edge Function.
//
// Phase A — raw connectivity via postgres.js (npm:postgres), known-good on
//           Deno. If this fails, the problem is network/config, not Prisma.
// Phase B — Prisma with the query compiler + pg driver adapter: the
//           load-bearing risk called out in the architecture doc. Requires
//           `npx prisma generate` to have emitted the Deno client into
//           supabase/functions/_shared/prisma (see the `edge` generator in
//           prisma/schema.prisma) before deploying.
//
// DB URL: SPIKE_DB_URL (set to the Supavisor transaction pooler, port 6543,
// to exercise the production path) falls back to SUPABASE_DB_URL, which the
// platform injects automatically.
//
// Invoke (default verify_jwt, so pass the anon key):
//   curl https://<ref>.supabase.co/functions/v1/prisma-spike \
//     -H "Authorization: Bearer <anon key>"

Deno.serve(async () => {
  const url = Deno.env.get('SPIKE_DB_URL') ?? Deno.env.get('SUPABASE_DB_URL');
  if (!url) {
    return Response.json({ error: 'Neither SPIKE_DB_URL nor SUPABASE_DB_URL is set' }, { status: 500 });
  }

  const report: Record<string, unknown> = {
    db_url_source: Deno.env.get('SPIKE_DB_URL') ? 'SPIKE_DB_URL' : 'SUPABASE_DB_URL',
  };

  try {
    const postgres = (await import('npm:postgres@3.4')).default;
    // prepare: false — Supavisor transaction mode does not support prepared statements.
    const sql = postgres(url, { prepare: false, max: 1 });
    const [row] = await sql`select version()`;
    await sql.end({ timeout: 2 });
    report.phase_a_raw_sql = { ok: true, server: row.version };
  } catch (e) {
    report.phase_a_raw_sql = { ok: false, error: String(e) };
  }

  try {
    const { PrismaPg } = await import('npm:@prisma/adapter-pg@6');
    const { PrismaClient } = await import('../_shared/prisma/client.ts');
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    const userCount = await prisma.user.count();
    await prisma.$disconnect();
    report.phase_b_prisma = { ok: true, user_count: userCount };
  } catch (e) {
    report.phase_b_prisma = { ok: false, error: String(e) };
  }

  return Response.json(report);
});

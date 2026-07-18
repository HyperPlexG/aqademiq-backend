/**
 * Supabase DB connectivity smoke test.
 *
 *   node scripts/test-db-connection.mjs
 *
 * Reads DATABASE_URL from .env, connects with Prisma, and runs a couple of
 * read-only queries against the deployed schema. Prints a clear PASS/FAIL.
 *
 * Prereqs: fill DATABASE_URL in .env with the real pooler host + password
 * (Dashboard > Project Settings > Database > Connection string), then
 * `npx prisma generate` if you haven't already.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const text = readFileSync(join(root, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return undefined;
}

const url = readEnv('DATABASE_URL');
if (!url || /\[YOUR-DB-PASSWORD\]|\[POOLER-HOST\]|<password>|<pooler-host>/.test(url)) {
  console.error('✖ DATABASE_URL is missing or still contains placeholders. Fill it in .env first.');
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  await prisma.$connect();
  const presets = await prisma.prismPreset.count();
  const profiles = await prisma.profile.count();
  const [{ tables }] = await prisma.$queryRawUnsafe(
    "select count(*)::int as tables from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
  );
  console.log('✔ Connected to Supabase Postgres');
  console.log(`  public tables : ${tables}`);
  console.log(`  prism_presets : ${presets}`);
  console.log(`  profiles      : ${profiles}`);
  console.log('PASS');
} catch (e) {
  console.error('✖ Connection/query failed:');
  console.error('  ' + (e?.message ?? String(e)).split('\n')[0]);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect().catch(() => {});
}

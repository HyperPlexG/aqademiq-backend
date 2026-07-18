/**
 * Provision a database from scratch: applies every supabase/migrations/*.sql
 * in filename (timestamp) order via `prisma db execute`.
 *
 *   node scripts/db-bootstrap.mjs [--local] [--url <postgres-url>]
 *
 * --local  also applies scripts/dev-auth-shim.sql FIRST (stub auth schema for
 *          plain Postgres). NEVER pass --local against a real Supabase project.
 * --url    target DB. Defaults to DIRECT_URL, then DATABASE_URL (from env or .env).
 *
 * On the live Supabase project the migrations are already applied — this
 * script is for local dev and fresh environments.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

const args = process.argv.slice(2);
const local = args.includes('--local');
const urlIdx = args.indexOf('--url');
const url = urlIdx >= 0 ? args[urlIdx + 1] : (readEnv('DIRECT_URL') ?? readEnv('DATABASE_URL'));

if (!url) {
  console.error('✖ No target URL — pass --url or set DIRECT_URL / DATABASE_URL');
  process.exit(2);
}

const files = [];
if (local) files.push(join(root, 'scripts', 'dev-auth-shim.sql'));
const migDir = join(root, 'supabase', 'migrations');
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  files.push(join(migDir, f));
}

for (const file of files) {
  process.stdout.write(`→ ${file.replace(root, '').replace(/\\/g, '/')} ... `);
  // shell:true (needed for npx on Windows) word-splits args — quote paths/URLs.
  const res = spawnSync('npx', ['prisma', 'db', 'execute', '--file', `"${file}"`, '--url', `"${url}"`], {
    cwd: root,
    shell: true,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    console.log('FAILED');
    console.error(res.stderr || res.stdout);
    process.exit(1);
  }
  console.log('ok');
}
console.log(`✔ Bootstrap complete (${files.length} file(s) applied)`);

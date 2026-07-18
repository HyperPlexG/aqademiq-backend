/**
 * Feedback & roadmap board — data-path smoke test.
 *
 *   node scripts/test-feedback-board.mjs
 *
 * Exercises the phase-1 board through the SAME Prisma client the NestJS backend
 * uses, against the deployed Supabase DB: reads the seeded status/category
 * config, then round-trips a post → status change → changelog entry (create,
 * read back, then fully clean up). Prints a clear PASS/FAIL.
 *
 * FK-bound flows (vote / comment / subscription) reference auth.users(id) and
 * therefore need a real authenticated user; they are covered by the compile +
 * transaction logic, not live-inserted here (writing to auth.users is blocked).
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let postId = null;
try {
  await prisma.$connect();

  // 1. Seeded config
  const statuses = await prisma.feedbackStatus.findMany({ orderBy: { sort_order: 'asc' } });
  const categories = await prisma.feedbackCategory.findMany();
  assert(statuses.length === 5, `expected 5 statuses, got ${statuses.length}`);
  assert(categories.length === 8, `expected 8 categories, got ${categories.length}`);
  assert(statuses[0].key === 'under_review', `first status should be under_review, got ${statuses[0].key}`);

  // 2. Create a post (author_id null — no auth user required)
  const created = await prisma.feedbackPost.create({
    data: { title: 'SMOKE TEST — dark mode for Focus timer', body: 'testing', category_key: 'focus' },
  });
  postId = created.id;
  assert(typeof created.ref === 'number' && created.ref > 0, `post should get a public ref, got ${created.ref}`);
  assert(created.status_key === 'under_review', `default status should be under_review, got ${created.status_key}`);

  // 3. Read back by ref + search
  const byRef = await prisma.feedbackPost.findUnique({ where: { ref: created.ref } });
  assert(byRef && byRef.id === postId, 'post not found by ref');
  const search = await prisma.feedbackPost.findMany({
    where: { title: { contains: 'dark mode', mode: 'insensitive' } },
  });
  assert(search.some((p) => p.id === postId), 'search did not return the post');

  // 4. Status change (actor null) + move to planned (roadmap)
  await prisma.$transaction(async (tx) => {
    await tx.feedbackPost.update({ where: { id: postId }, data: { status_key: 'planned' } });
    await tx.feedbackStatusChange.create({
      data: { post_id: postId, from_status: 'under_review', to_status: 'planned' },
    });
  });
  const changes = await prisma.feedbackStatusChange.findMany({ where: { post_id: postId } });
  assert(changes.length === 1 && changes[0].to_status === 'planned', 'status change not recorded');

  // 5. Roadmap grouping sees it under a planned/on_roadmap status
  const roadmapKeys = statuses.filter((s) => s.on_roadmap).map((s) => s.key);
  assert(roadmapKeys.includes('planned'), 'planned should be an on_roadmap status');
  const onRoadmap = await prisma.feedbackPost.findMany({
    where: { status_key: { in: roadmapKeys }, id: postId },
  });
  assert(onRoadmap.length === 1, 'post should appear on the roadmap after being planned');

  // 6. Changelog draft → publish, linked to the shipped request
  const entry = await prisma.changelogEntry.create({
    data: { title: 'Dark mode shipped', body: 'Now available.', source_post: postId, published_at: new Date() },
  });
  const published = await prisma.changelogEntry.findMany({
    where: { published_at: { not: null }, source_post: postId },
  });
  assert(published.some((e) => e.id === entry.id), 'published changelog entry not found');

  console.log('✔ Feedback board data path verified against Supabase');
  console.log(`  statuses         : ${statuses.length} (seeded)`);
  console.log(`  categories       : ${categories.length} (seeded)`);
  console.log(`  post round-trip  : #${created.ref} create → search → status-change → roadmap`);
  console.log(`  changelog        : draft → publish (linked to #${created.ref})`);
  console.log('PASS');
} catch (e) {
  console.error('✖ Feedback board test failed:');
  console.error('  ' + (e?.message ?? String(e)).split('\n')[0]);
  process.exitCode = 1;
} finally {
  // Cleanup — cascade removes votes/comments/subs/status_changes; changelog + post explicit.
  if (postId != null) {
    try {
      await prisma.changelogEntry.deleteMany({ where: { source_post: postId } });
      await prisma.feedbackPost.delete({ where: { id: postId } });
    } catch (e) {
      console.error('  (cleanup warning) ' + (e?.message ?? String(e)).split('\n')[0]);
    }
  }
  await prisma.$disconnect().catch(() => {});
}

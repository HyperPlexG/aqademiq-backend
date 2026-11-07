// The Anthropic spend ledger, run against a real Postgres (PGlite, in-process).
//
// 20261107130000_ai_spend.sql is what stops Ada passing the monthly cap. The
// cases that matter for money:
//   - reservations add up, and one that would pass the cap is refused whole;
//   - a student's daily share refuses only that student, and charges nothing;
//   - settling moves a reservation to the real cost, and never below zero;
//   - a new period starts from zero;
//   - only the server can call it.

import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.2.17';

const MIGRATION = new URL('../../migrations/20261107130000_ai_spend.sql', import.meta.url);
const NOV = '2026-11-01';
const DAY = '2026-11-07';
const ALICE = 'anthropic:user:a';
const BOB = 'anthropic:user:b';

async function database(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await Deno.readTextFile(MIGRATION));
  return db;
}

async function reserve(db: PGlite, amount: number, cap = 99, user: string | null = null, userCap: number | null = null) {
  const r = await db.query<{ total: string | null }>(
    'select ai_spend_reserve($1, $2::date, $3::numeric, $4::numeric, $5, $6::date, $7::numeric) as total',
    ['anthropic', NOV, amount, cap, user, DAY, userCap],
  );
  const t = r.rows[0].total;
  return t === null ? null : Number(t);
}

async function spent(db: PGlite, scope: string, period: string): Promise<number> {
  const r = await db.query<{ spent_usd: string }>('select spent_usd from ai_spend where scope = $1 and period_start = $2::date', [scope, period]);
  return r.rows.length ? Number(r.rows[0].spent_usd) : 0;
}

Deno.test('reservations add up until the next one would pass the cap', async () => {
  const db = await database();
  assertEquals(await reserve(db, 40), 40);
  assertEquals(await reserve(db, 50), 90);
  assertEquals(await reserve(db, 9.5), null); // 99.5 > 99: refused whole
  assertEquals(await spent(db, 'anthropic', NOV), 90);
  assertEquals(await reserve(db, 9), 99); // exactly the cap is allowed
  assertEquals(await reserve(db, 0.000001), null);
});

Deno.test("a student's daily share refuses only that student, and charges neither scope", async () => {
  const db = await database();
  assertEquals(await reserve(db, 3, 99, ALICE, 5), 3);
  assertEquals(await reserve(db, 3, 99, ALICE, 5), -1); // Alice would be at 6 > 5
  assertEquals(await spent(db, 'anthropic', NOV), 3); // the refused 3 was given back
  assertEquals(await spent(db, ALICE, DAY), 3);
  assertEquals(await reserve(db, 3, 99, BOB, 5), 6); // Bob is unaffected
});

Deno.test('settling moves a reservation to the real cost, never below zero', async () => {
  const db = await database();
  await reserve(db, 0.5, 99, ALICE, 5);
  await db.query('select ai_spend_settle($1, $2::date, $3::numeric, $4, $5::date)', ['anthropic', NOV, -0.42, ALICE, DAY]);
  assertEquals(await spent(db, 'anthropic', NOV), 0.08);
  assertEquals(await spent(db, ALICE, DAY), 0.08);
  await db.query('select ai_spend_settle($1, $2::date, $3::numeric, $4, $5::date)', ['anthropic', NOV, -5, null, null]);
  assertEquals(await spent(db, 'anthropic', NOV), 0);
});

Deno.test('a new period starts from zero', async () => {
  const db = await database();
  assertEquals(await reserve(db, 99), 99);
  const r = await db.query<{ total: string }>(
    'select ai_spend_reserve($1, $2::date, $3::numeric, $4::numeric) as total',
    ['anthropic', '2026-12-01', 1, 99],
  );
  assertEquals(Number(r.rows[0].total), 1);
});

Deno.test('a negative reservation is refused', async () => {
  const db = await database();
  await assertRejects(() => reserve(db, -1), Error, 'must not be negative');
});

Deno.test('the app roles cannot call the ledger', async () => {
  const db = await database();
  await db.exec('set role authenticated');
  await assertRejects(() => reserve(db, 1), Error, 'permission denied');
});

// The Apple re-link migration, run against a real Postgres (PGlite, in-process).
//
// 20261015120000_apple_team_transfer.sql edits auth.identities and auth.users
// for the people who signed in with Apple before the app changed developer
// teams. A mistake there strands someone's account, so every case it has to
// get right is exercised here against the actual SQL rather than a mock:
//
//   - a Hide My Email user moves to the new id, and their relay email follows;
//   - a real-email user moves, and their own address is left alone;
//   - running it twice changes nothing;
//   - if the new id already has an account of its own, nothing is taken over —
//     the case is recorded for a hand merge instead;
//   - nobody but the server can call it or read the snapshot.
//
// auth.* here is a minimal stand-in with the columns the migration touches,
// shaped like Supabase's own (including the generated `email` column and the
// (provider_id, provider) uniqueness).

import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.2.17';

const MIGRATION = new URL(
  '../../migrations/20261015120000_apple_team_transfer.sql',
  import.meta.url,
);

const U_RELAY = '00000000-0000-0000-0000-000000000001';
const U_REAL = '00000000-0000-0000-0000-000000000002';
const U_GOOGLE = '00000000-0000-0000-0000-000000000003';
const U_SPLIT = '00000000-0000-0000-0000-000000000004'; // old account…
const U_FRESH = '00000000-0000-0000-0000-000000000005'; // …and the empty one made after the move

async function database(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      updated_at timestamptz default now()
    );
    create table auth.identities (
      id uuid primary key default gen_random_uuid(),
      provider_id text not null,
      user_id uuid not null references auth.users (id),
      identity_data jsonb not null,
      provider text not null,
      last_sign_in_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      email text generated always as (lower(identity_data ->> 'email')) stored,
      unique (provider_id, provider)
    );
    grant usage on schema public to anon, authenticated, service_role;

    insert into auth.users (id, email) values
      ('${U_RELAY}',  'old1@privaterelay.appleid.com'),
      ('${U_REAL}',   'person@example.com'),
      ('${U_GOOGLE}', 'g@example.com'),
      ('${U_SPLIT}',  'old4@privaterelay.appleid.com'),
      ('${U_FRESH}',  'new4@privaterelay.appleid.com');
    insert into auth.identities (provider_id, user_id, identity_data, provider) values
      ('old-1', '${U_RELAY}',  '{"sub":"old-1","email":"old1@privaterelay.appleid.com","is_private_email":true}', 'apple'),
      ('old-2', '${U_REAL}',   '{"sub":"old-2","email":"person@example.com"}', 'apple'),
      ('g-3',   '${U_GOOGLE}', '{"sub":"g-3","email":"g@example.com"}', 'google'),
      ('old-4', '${U_SPLIT}',  '{"sub":"old-4","email":"old4@privaterelay.appleid.com"}', 'apple'),
      ('new-4', '${U_FRESH}',  '{"sub":"new-4","email":"new4@privaterelay.appleid.com"}', 'apple');
  `);
  await db.exec(await Deno.readTextFile(MIGRATION));
  return db;
}

async function relink(db: PGlite, user: string, sub: string, email: string | null): Promise<string> {
  const r = await db.query<{ s: string }>('select public.apple_relink($1, $2, $3) as s', [user, sub, email]);
  return r.rows[0].s;
}

async function needed(db: PGlite, user: string): Promise<boolean> {
  const r = await db.query<{ n: boolean }>('select public.apple_relink_needed($1) as n', [user]);
  return r.rows[0].n;
}

async function identity(db: PGlite, user: string) {
  const r = await db.query<{ provider_id: string; identity_data: Record<string, unknown>; email: string }>(
    `select provider_id, identity_data, email from auth.identities where user_id = $1 and provider = 'apple'`,
    [user],
  );
  return r.rows[0];
}

async function userEmail(db: PGlite, user: string): Promise<string> {
  return (await db.query<{ email: string }>('select email from auth.users where id = $1', [user])).rows[0].email;
}

Deno.test('the snapshot takes every Apple identity, and only Apple ones', async () => {
  const db = await database();
  const rows = (await db.query<{ old_sub: string }>('select old_sub from public.apple_team_transfer order by old_sub')).rows;
  assertEquals(rows.map((r) => r.old_sub), ['new-4', 'old-1', 'old-2', 'old-4']);
  assertEquals(await needed(db, U_RELAY), true);
  assertEquals(await needed(db, U_GOOGLE), false);
});

Deno.test('a Hide My Email user moves to the new id, and the relay address follows', async () => {
  const db = await database();
  assertEquals(await relink(db, U_RELAY, 'new-1', 'new1@privaterelay.appleid.com'), 'linked');

  const id = await identity(db, U_RELAY);
  assertEquals(id.provider_id, 'new-1');
  assertEquals(id.identity_data.sub, 'new-1');
  assertEquals(id.identity_data.email, 'new1@privaterelay.appleid.com');
  assertEquals(id.identity_data.is_private_email, true, 'keys it did not set are kept');
  assertEquals(id.email, 'new1@privaterelay.appleid.com');
  assertEquals(await userEmail(db, U_RELAY), 'new1@privaterelay.appleid.com');

  assertEquals(await needed(db, U_RELAY), false);
  const row = (await db.query<{ relinked_by: string; new_sub: string }>(
    `select relinked_by, new_sub from public.apple_team_transfer where old_sub = 'old-1'`,
  )).rows[0];
  assertEquals(row, { relinked_by: 'device', new_sub: 'new-1' });
});

Deno.test('sharing a real address that another account already uses leaves the email alone', async () => {
  // The re-link itself still happens: it is the Apple id that matters.
  const db = await database();
  assertEquals(await relink(db, U_RELAY, 'new-1', 'person@example.com'), 'linked');
  assertEquals((await identity(db, U_RELAY)).provider_id, 'new-1');
  assertEquals(await userEmail(db, U_RELAY), 'old1@privaterelay.appleid.com');
  assertEquals(await userEmail(db, U_REAL), 'person@example.com');
});

Deno.test('a real email the person chose is never overwritten', async () => {
  const db = await database();
  assertEquals(await relink(db, U_REAL, 'new-2', 'person@example.com'), 'linked');
  assertEquals((await identity(db, U_REAL)).provider_id, 'new-2');
  assertEquals(await userEmail(db, U_REAL), 'person@example.com');
});

Deno.test('Apple sending no email this time keeps the one on file', async () => {
  // Apple only includes the email on some sign-ins.
  const db = await database();
  assertEquals(await relink(db, U_RELAY, 'new-1', null), 'linked');
  assertEquals((await identity(db, U_RELAY)).identity_data.email, 'old1@privaterelay.appleid.com');
  assertEquals(await userEmail(db, U_RELAY), 'old1@privaterelay.appleid.com');
});

Deno.test('running it twice is harmless', async () => {
  const db = await database();
  assertEquals(await relink(db, U_RELAY, 'new-1', 'new1@privaterelay.appleid.com'), 'linked');
  assertEquals(await relink(db, U_RELAY, 'new-1', 'new1@privaterelay.appleid.com'), 'already');
  assertEquals((await identity(db, U_RELAY)).provider_id, 'new-1');
});

Deno.test('an id that already has an account is recorded, never taken over', async () => {
  const db = await database();
  assertEquals(await relink(db, U_SPLIT, 'new-4', 'new4@privaterelay.appleid.com'), 'conflict');

  // Both accounts exactly as they were.
  assertEquals((await identity(db, U_SPLIT)).provider_id, 'old-4');
  assertEquals((await identity(db, U_FRESH)).provider_id, 'new-4');
  assertEquals(await userEmail(db, U_SPLIT), 'old4@privaterelay.appleid.com');

  const row = (await db.query<{ conflict_user_id: string; relinked_at: string | null }>(
    `select conflict_user_id, relinked_at from public.apple_team_transfer where old_sub = 'old-4'`,
  )).rows[0];
  assertEquals(row.conflict_user_id, U_FRESH);
  assertEquals(row.relinked_at, null);
  // It stops prompting: the rest is a hand merge.
  assertEquals(await needed(db, U_SPLIT), false);
});

Deno.test('an account made after the move confirms itself and stops being asked', async () => {
  const db = await database();
  assertEquals(await needed(db, U_FRESH), true);
  assertEquals(await relink(db, U_FRESH, 'new-4', 'new4@privaterelay.appleid.com'), 'already');
  assertEquals(await needed(db, U_FRESH), false);
});

Deno.test('a user without Apple sign-in is told so and nothing changes', async () => {
  const db = await database();
  assertEquals(await relink(db, U_GOOGLE, 'anything', null), 'no_apple_identity');
  assertEquals((await db.query(`select 1 from auth.identities where provider_id = 'anything'`)).rows.length, 0);
});

Deno.test('clients cannot call it or read the snapshot', async () => {
  const db = await database();
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assertRejects(() => relink(db, U_RELAY, 'stolen', null));
    await assertRejects(() => needed(db, U_RELAY));
    await assertRejects(() => db.query('select * from public.apple_team_transfer'));
    await db.exec('reset role');
  }
  assertEquals((await identity(db, U_RELAY)).provider_id, 'old-1');
});

Deno.test('the server role can call both', async () => {
  const db = await database();
  await db.exec('set role service_role');
  assert(await needed(db, U_RELAY));
  assertEquals(await relink(db, U_RELAY, 'new-1', null), 'linked');
  await db.exec('reset role');
});

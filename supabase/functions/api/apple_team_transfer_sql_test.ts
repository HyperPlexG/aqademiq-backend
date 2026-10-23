// The Apple team-transfer migration, run against a real Postgres (PGlite, in-process).
//
// 20261023120000_apple_team_transfer.sql edits auth.identities, auth.users and
// profiles for the people who signed in with Apple before the app changed
// developer teams. A mistake there strands someone's account, so every case it
// has to get right is exercised here against the actual SQL rather than a mock:
//
//   - a Hide My Email user moves to the new id, and their relay email follows
//     (in auth and on the profile);
//   - a real-email user moves, and their own address is left alone;
//   - running it twice changes nothing;
//   - if the new id already has an account of its own, nothing is taken over —
//     the case is recorded for a hand merge instead;
//   - nobody but the server can call it or read the snapshot.
//
// auth.* here is a minimal stand-in with the columns the migration touches,
// shaped like Supabase's own (including the generated `email` column and the
// (provider_id, provider) uniqueness).

import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.2.17';

const MIGRATION = new URL(
  '../../migrations/20261023120000_apple_team_transfer.sql',
  import.meta.url,
);

const U_RELAY = '00000000-0000-0000-0000-000000000001';
const U_REAL = '00000000-0000-0000-0000-000000000002';
const U_GOOGLE = '00000000-0000-0000-0000-000000000003';
const U_SPLIT = '00000000-0000-0000-0000-000000000004'; // old account…
const U_FRESH = '00000000-0000-0000-0000-000000000005'; // …and an empty one made after the move

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
    create table public.profiles (id uuid primary key, email varchar(255));
    grant usage on schema public to anon, authenticated, service_role;

    insert into auth.users (id, email) values
      ('${U_RELAY}',  'old1@privaterelay.appleid.com'),
      ('${U_REAL}',   'person@example.com'),
      ('${U_GOOGLE}', 'g@example.com'),
      ('${U_SPLIT}',  'old4@privaterelay.appleid.com'),
      ('${U_FRESH}',  'new4@privaterelay.appleid.com');
    insert into public.profiles (id, email) values
      ('${U_RELAY}',  'old1@privaterelay.appleid.com'),
      ('${U_REAL}',   'person@example.com');
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

async function relink(db: PGlite, oldSub: string, newSub: string, email: string | null): Promise<string> {
  const r = await db.query<{ s: string }>(
    'select public.apple_transfer_relink($1, $2, $3) as s',
    [oldSub, newSub, email],
  );
  return r.rows[0].s;
}

async function identity(db: PGlite, user: string) {
  const r = await db.query<{ provider_id: string; identity_data: Record<string, unknown>; email: string }>(
    `select provider_id, identity_data, email from auth.identities where user_id = $1 and provider = 'apple'`,
    [user],
  );
  return r.rows[0];
}

async function emails(db: PGlite, user: string): Promise<{ auth: string; profile: string | null }> {
  const auth = (await db.query<{ email: string }>('select email from auth.users where id = $1', [user])).rows[0].email;
  const p = (await db.query<{ email: string }>('select email from public.profiles where id = $1', [user])).rows[0];
  return { auth, profile: p?.email ?? null };
}

Deno.test('the snapshot takes every Apple identity, and only Apple ones', async () => {
  const db = await database();
  const rows = (await db.query<{ old_sub: string }>('select old_sub from public.apple_team_transfer order by old_sub')).rows;
  assertEquals(rows.map((r) => r.old_sub), ['new-4', 'old-1', 'old-2', 'old-4']);
});

Deno.test('a Hide My Email user moves to the new id, and the relay address follows', async () => {
  const db = await database();
  assertEquals(await relink(db, 'old-1', 'new-1', 'new1@privaterelay.appleid.com'), 'linked');

  const id = await identity(db, U_RELAY);
  assertEquals(id.provider_id, 'new-1');
  assertEquals(id.identity_data.sub, 'new-1');
  assertEquals(id.identity_data.email, 'new1@privaterelay.appleid.com');
  assertEquals(id.identity_data.is_private_email, true, 'keys it did not set are kept');
  assertEquals(id.email, 'new1@privaterelay.appleid.com');
  assertEquals(await emails(db, U_RELAY), {
    auth: 'new1@privaterelay.appleid.com',
    profile: 'new1@privaterelay.appleid.com',
  });

  const row = (await db.query<{ relinked_by: string; new_sub: string }>(
    `select relinked_by, new_sub from public.apple_team_transfer where old_sub = 'old-1'`,
  )).rows[0];
  assertEquals(row, { relinked_by: 'apple_transfer', new_sub: 'new-1' });
});

Deno.test('a real-email user moves, and their own address is never overwritten', async () => {
  // Apple returns no email for these users; even if it did, it is not a relay.
  const db = await database();
  assertEquals(await relink(db, 'old-2', 'new-2', null), 'linked');
  assertEquals((await identity(db, U_REAL)).provider_id, 'new-2');
  assertEquals((await identity(db, U_REAL)).identity_data.email, 'person@example.com');
  assertEquals(await emails(db, U_REAL), { auth: 'person@example.com', profile: 'person@example.com' });
});

Deno.test('a new address another account already uses is left alone', async () => {
  // The Apple id still moves — that is what matters for signing in.
  const db = await database();
  assertEquals(await relink(db, 'old-1', 'new-1', 'person@example.com'), 'linked');
  assertEquals((await identity(db, U_RELAY)).provider_id, 'new-1');
  assertEquals((await emails(db, U_RELAY)).auth, 'old1@privaterelay.appleid.com');
  assertEquals((await emails(db, U_REAL)).auth, 'person@example.com');
});

Deno.test('running it twice is harmless', async () => {
  const db = await database();
  assertEquals(await relink(db, 'old-1', 'new-1', 'new1@privaterelay.appleid.com'), 'linked');
  assertEquals(await relink(db, 'old-1', 'new-1', 'new1@privaterelay.appleid.com'), 'already');
  assertEquals((await identity(db, U_RELAY)).provider_id, 'new-1');
});

Deno.test('an id that already has an account is recorded, never taken over', async () => {
  const db = await database();
  assertEquals(await relink(db, 'old-4', 'new-4', 'new4@privaterelay.appleid.com'), 'conflict');

  // Both accounts exactly as they were.
  assertEquals((await identity(db, U_SPLIT)).provider_id, 'old-4');
  assertEquals((await identity(db, U_FRESH)).provider_id, 'new-4');
  assertEquals((await emails(db, U_SPLIT)).auth, 'old4@privaterelay.appleid.com');

  const row = (await db.query<{ conflict_user_id: string; relinked_at: string | null }>(
    `select conflict_user_id, relinked_at from public.apple_team_transfer where old_sub = 'old-4'`,
  )).rows[0];
  assertEquals(row.conflict_user_id, U_FRESH);
  assertEquals(row.relinked_at, null);
});

Deno.test('an id that was never snapshotted changes nothing', async () => {
  const db = await database();
  assertEquals(await relink(db, 'g-3', 'anything', null), 'unknown_old_sub');
  assertEquals(await relink(db, 'nobody', 'anything', null), 'unknown_old_sub');
  assertEquals((await db.query(`select 1 from auth.identities where provider_id = 'anything'`)).rows.length, 0);
});

Deno.test('clients cannot call it or read the snapshot', async () => {
  const db = await database();
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assertRejects(() => relink(db, 'old-1', 'stolen', null));
    await assertRejects(() => db.query('select * from public.apple_team_transfer'));
    await db.exec('reset role');
  }
  assertEquals((await identity(db, U_RELAY)).provider_id, 'old-1');
});

Deno.test('the server role can call it', async () => {
  const db = await database();
  await db.exec('set role service_role');
  assertEquals(await relink(db, 'old-1', 'new-1', null), 'linked');
  await db.exec('reset role');
});

-- Sign in with Apple after the app moved Apple developer teams (October 2026).
--
-- Apple scopes a user's id (`sub`) to the developer team that owns the app.
-- Aqademiq moved from team SXN54W6F6T to R6YW5K2YSP, so everyone who signed in
-- with Apple before the move is issued a different id when they next sign in —
-- and Supabase, finding no identity with it, creates a new, empty account.
-- People who chose Hide My Email get a new relay address too, so nothing can
-- match them back by email either.
--
-- This migration deletes nothing. It:
--   1. Snapshots every Apple identity as it stands. The old ids are what Apple's
--      own transfer process takes as input, and the only record of who was who
--      once anything has been re-linked.
--   2. Adds apple_relink(): moves a user's Apple identity to the id Apple now
--      issues them. The API calls it only for the signed-in user, after
--      verifying a fresh Apple identity token from that same device — the
--      still-valid session is the proof of ownership Apple's ids no longer give.
--   3. Adds apple_relink_needed(), which the app asks on launch.

create table if not exists public.apple_team_transfer (
  old_sub             text primary key,
  user_id             uuid not null,
  old_email           text,
  identity_created_at timestamptz,
  last_sign_in_at     timestamptz,
  snapshot_at         timestamptz not null default now(),
  new_sub             text,
  new_email           text,
  relinked_at         timestamptz,
  relinked_by         text check (relinked_by in ('device', 'apple_transfer', 'merge')),
  -- Set when the new id already belongs to another account: someone signed in
  -- fresh before re-linking. Those two accounts are merged by hand, never
  -- automatically.
  conflict_user_id    uuid
);

comment on table public.apple_team_transfer is
  'Apple identities as they were before the October 2026 team transfer, and how each was re-linked. Server-only.';

-- Server-only: RLS on and no policies, so every client role is denied.
alter table public.apple_team_transfer enable row level security;
revoke all on public.apple_team_transfer from anon, authenticated;

insert into public.apple_team_transfer (old_sub, user_id, old_email, identity_created_at, last_sign_in_at)
select provider_id, user_id, identity_data ->> 'email', created_at, last_sign_in_at
  from auth.identities
 where provider = 'apple'
on conflict (old_sub) do nothing;

create or replace function public.apple_relink_needed(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.apple_team_transfer t
     where t.user_id = p_user
       and t.relinked_at is null
       and t.conflict_user_id is null
  );
$$;

create or replace function public.apple_relink(p_user uuid, p_new_sub text, p_new_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity_id uuid;
  v_old_sub     text;
  v_old_email   text;
  v_owner       uuid;
begin
  if p_user is null or coalesce(p_new_sub, '') = '' then
    raise exception 'apple_relink: user and new sub are required';
  end if;

  -- Already on the id Apple issues now: nothing to move. Still record it, so
  -- the app stops asking.
  if exists (select 1 from auth.identities
              where user_id = p_user and provider = 'apple' and provider_id = p_new_sub) then
    update public.apple_team_transfer
       set new_sub = p_new_sub, new_email = p_new_email,
           relinked_at = now(), relinked_by = 'device'
     where user_id = p_user and relinked_at is null;
    return 'already';
  end if;

  -- The user's Apple identity from before the move.
  select i.id, i.provider_id, i.identity_data ->> 'email'
    into v_identity_id, v_old_sub, v_old_email
    from auth.identities i
    join public.apple_team_transfer t on t.old_sub = i.provider_id and t.user_id = i.user_id
   where i.user_id = p_user and i.provider = 'apple'
   limit 1
   for update of i;

  if v_identity_id is null then
    return 'no_apple_identity';
  end if;

  -- The new id already has an account of its own. Never take it over here:
  -- record it, and leave both accounts exactly as they are for a hand merge.
  select user_id into v_owner
    from auth.identities
   where provider = 'apple' and provider_id = p_new_sub and user_id <> p_user
   limit 1;

  if v_owner is not null then
    update public.apple_team_transfer
       set new_sub = p_new_sub, new_email = p_new_email, conflict_user_id = v_owner
     where old_sub = v_old_sub;
    return 'conflict';
  end if;

  update auth.identities
     set provider_id   = p_new_sub,
         identity_data = identity_data
                         || jsonb_build_object('sub', p_new_sub, 'provider_id', p_new_sub)
                         || case when p_new_email is null then '{}'::jsonb
                                 else jsonb_build_object('email', p_new_email) end,
         updated_at    = now()
   where id = v_identity_id;

  -- A Hide My Email address belongs to the old team and may stop forwarding.
  -- Follow it to the new one, but only when the account's email *is* that
  -- old relay address: a real address the person typed stays untouched.
  if p_new_email is not null
     and v_old_email ilike '%@privaterelay.appleid.com' then
    update auth.users
       set email = p_new_email, updated_at = now()
     where id = p_user
       and lower(email) = lower(v_old_email);
  end if;

  update public.apple_team_transfer
     set new_sub = p_new_sub, new_email = p_new_email,
         relinked_at = now(), relinked_by = 'device'
   where old_sub = v_old_sub;

  return 'linked';
end;
$$;

-- Callable only by the server. Public-schema functions are otherwise reachable
-- through PostgREST RPC by any signed-in client.
revoke all on function public.apple_relink(uuid, text, text) from public, anon, authenticated;
revoke all on function public.apple_relink_needed(uuid) from public, anon, authenticated;
grant execute on function public.apple_relink(uuid, text, text) to service_role;
grant execute on function public.apple_relink_needed(uuid) to service_role;

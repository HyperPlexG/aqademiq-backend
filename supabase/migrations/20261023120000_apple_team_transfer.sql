-- Sign in with Apple after the app moved Apple developer teams (October 2026).
--
-- Apple scopes a user's id (`sub`) to the developer team that owns the app.
-- Aqademiq moved from team SXN54W6F6T to R6YW5K2YSP, so everyone who signed in
-- with Apple before the move is issued a different id when they next sign in —
-- and Supabase, finding no identity with it, would create a new, empty account.
-- Hide My Email users get a new relay address too, so nothing could match them
-- back by email either.
--
-- Apple's own user migration gives each old id its new-team id (and, for Hide
-- My Email users, the new relay address): see apple_user_migration.py in the
-- workspace root. This migration deletes nothing. It:
--   1. Snapshots every Apple identity as it stands — the record of who was who,
--      and of how each one was moved.
--   2. Adds apple_transfer_relink(), which moves one account's Apple identity
--      from its old id to the one Apple issued for it. Server-only; run once
--      per user with Apple's answers, never from the app.

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
  relinked_by         text check (relinked_by in ('apple_transfer', 'merge')),
  -- Set when the new id already belongs to another account: someone signed in
  -- fresh before being moved. Those two accounts are merged by hand, never
  -- automatically.
  conflict_user_id    uuid
);

comment on table public.apple_team_transfer is
  'Apple identities as they were before the October 2026 team transfer, and how each was moved. Server-only.';

-- Server-only: RLS on and no policies, so every client role is denied.
alter table public.apple_team_transfer enable row level security;
revoke all on public.apple_team_transfer from anon, authenticated;

insert into public.apple_team_transfer (old_sub, user_id, old_email, identity_created_at, last_sign_in_at)
select provider_id, user_id, identity_data ->> 'email', created_at, last_sign_in_at
  from auth.identities
 where provider = 'apple'
on conflict (old_sub) do nothing;

create or replace function public.apple_transfer_relink(p_old_sub text, p_new_sub text, p_new_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user        uuid;
  v_done        timestamptz;
  v_identity_id uuid;
  v_old_email   text;
  v_owner       uuid;
begin
  if coalesce(p_old_sub, '') = '' or coalesce(p_new_sub, '') = '' then
    raise exception 'apple_transfer_relink: old and new sub are required';
  end if;

  select user_id, relinked_at into v_user, v_done
    from public.apple_team_transfer
   where old_sub = p_old_sub
   for update;

  if v_user is null then
    return 'unknown_old_sub';
  end if;
  if v_done is not null then
    return 'already';
  end if;

  select id, identity_data ->> 'email'
    into v_identity_id, v_old_email
    from auth.identities
   where provider = 'apple' and provider_id = p_old_sub and user_id = v_user
   for update;

  if v_identity_id is null then
    return 'no_apple_identity';
  end if;

  -- The new id already has an account of its own. Never take it over here:
  -- record it, and leave both accounts exactly as they are for a hand merge.
  select user_id into v_owner
    from auth.identities
   where provider = 'apple' and provider_id = p_new_sub and user_id <> v_user
   limit 1;

  if v_owner is not null then
    update public.apple_team_transfer
       set new_sub = p_new_sub, new_email = p_new_email, conflict_user_id = v_owner
     where old_sub = p_old_sub;
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

  -- A Hide My Email address belongs to the old team and stops forwarding.
  -- Follow it to the new one — but only where the account's email *is* that
  -- old relay address: a real address the person typed stays untouched, and
  -- so does one another account already uses.
  if p_new_email is not null
     and v_old_email ilike '%@privaterelay.appleid.com'
     and not exists (select 1 from auth.users o
                      where lower(o.email) = lower(p_new_email) and o.id <> v_user) then
    update auth.users
       set email = p_new_email, updated_at = now()
     where id = v_user
       and lower(email) = lower(v_old_email);

    update public.profiles
       set email = p_new_email
     where id = v_user
       and lower(email) = lower(v_old_email);
  end if;

  update public.apple_team_transfer
     set new_sub = p_new_sub, new_email = p_new_email,
         relinked_at = now(), relinked_by = 'apple_transfer'
   where old_sub = p_old_sub;

  return 'linked';
end;
$$;

-- Server-only. Public-schema functions are otherwise reachable through
-- PostgREST RPC by any signed-in client.
revoke all on function public.apple_transfer_relink(text, text, text) from public, anon, authenticated;
grant execute on function public.apple_transfer_relink(text, text, text) to service_role;

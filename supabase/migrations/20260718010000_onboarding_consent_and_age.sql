-- Onboarding: persist data-use consent (PDPL audit trail) + age.
-- Applied to Supabase project xqnjquozcnwmogipowpf on 2026-07-18.
--
-- Columns live on public.profiles (1:1 identity table; already holds
-- onboarding_complete + date_of_birth). consent_given defaults false so the
-- handle_new_user() signup trigger (which inserts profiles without these
-- columns) keeps working; consent_timestamp is nullable and stamped
-- server-side only when consent is actually recorded (honest audit trail).

alter table public.profiles
  add column consent_given     boolean     not null default false,
  add column consent_timestamp timestamptz,
  add column consent_version   text,
  add column age               integer;

alter table public.profiles
  add constraint profiles_age_range_chk check (age is null or (age >= 1 and age <= 120));

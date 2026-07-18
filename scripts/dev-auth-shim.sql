-- LOCAL DEV ONLY — never run against a real Supabase project.
-- Minimal stand-in for Supabase's auth schema so supabase/migrations/*.sql
-- (which reference auth.users(id) in FKs) apply cleanly to a plain Postgres.
-- On Supabase the real auth schema already exists; the bootstrap script only
-- applies this file when invoked with --local.
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

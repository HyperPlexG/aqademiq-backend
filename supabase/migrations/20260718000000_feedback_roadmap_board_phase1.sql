-- Feedback & roadmap board (nolt parity, phase 1).
-- Applied to Supabase project xqnjquozcnwmogipowpf on 2026-07-18.
-- User references point at auth.users(id) (uuid), matching the rest of the schema.

create table public.feedback_statuses (
  key         text primary key,
  label       text not null,
  color       text not null,
  sort_order  int  not null default 0,
  on_roadmap  boolean not null default true
);

create table public.feedback_categories (
  key   text primary key,
  label text not null
);

create sequence if not exists public.feedback_ref_seq start 1;

create table public.feedback_posts (
  id            bigint generated always as identity primary key,
  ref           int unique not null default nextval('public.feedback_ref_seq'),
  author_id     uuid references auth.users(id) on delete set null,
  title         text not null,
  body          text not null default '',
  status_key    text references public.feedback_statuses(key) default 'under_review',
  category_key  text references public.feedback_categories(key),
  upvotes       int  not null default 0,
  comment_count int  not null default 0,
  pinned        boolean not null default false,
  locked        boolean not null default false,
  approved      boolean not null default true,
  merged_into   bigint references public.feedback_posts(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index feedback_posts_status_idx   on public.feedback_posts (status_key);
create index feedback_posts_category_idx on public.feedback_posts (category_key);
create index feedback_posts_upvotes_idx  on public.feedback_posts (upvotes desc);

create table public.feedback_votes (
  post_id    bigint not null references public.feedback_posts(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.feedback_comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references public.feedback_posts(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  parent_id  bigint references public.feedback_comments(id),
  body       text not null,
  is_team    boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index feedback_comments_post_idx on public.feedback_comments (post_id);

create table public.feedback_comment_reactions (
  comment_id bigint not null references public.feedback_comments(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  emoji      text not null,
  primary key (comment_id, user_id, emoji)
);

create table public.feedback_status_changes (
  id          bigint generated always as identity primary key,
  post_id     bigint not null references public.feedback_posts(id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor_id    uuid references auth.users(id),
  note        text,
  created_at  timestamptz not null default now()
);
create index feedback_status_changes_post_idx on public.feedback_status_changes (post_id);

create table public.feedback_subscriptions (
  post_id    bigint not null references public.feedback_posts(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.feedback_admin_notes (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references public.feedback_posts(id) on delete cascade,
  author_id  uuid references auth.users(id),
  body       text not null,
  created_at timestamptz not null default now()
);

create table public.changelog_entries (
  id           bigint generated always as identity primary key,
  title        text not null,
  body         text not null,
  source_post  bigint references public.feedback_posts(id),
  published_at timestamptz
);

-- Match the app security model: RLS enabled with no policies. All access is via
-- the API over a privileged pooler connection (Prisma), same as every other table.
alter table public.feedback_statuses          enable row level security;
alter table public.feedback_categories        enable row level security;
alter table public.feedback_posts             enable row level security;
alter table public.feedback_votes             enable row level security;
alter table public.feedback_comments          enable row level security;
alter table public.feedback_comment_reactions enable row level security;
alter table public.feedback_status_changes    enable row level security;
alter table public.feedback_subscriptions     enable row level security;
alter table public.feedback_admin_notes       enable row level security;
alter table public.changelog_entries          enable row level security;

-- Seed the configurable status pipeline + app-area categories (design tokens from the plan).
insert into public.feedback_statuses (key, label, color, sort_order, on_roadmap) values
  ('under_review', 'Under review', '#777777', 0, false),
  ('planned',      'Planned',      '#6b5cf0', 1, true),
  ('in_progress',  'In progress',  '#e8a430', 2, true),
  ('shipped',      'Shipped',      '#2a9d6b', 3, true),
  ('declined',     'Declined',     '#c0c0c0', 4, false)
on conflict (key) do nothing;

insert into public.feedback_categories (key, label) values
  ('planner',  'Planner'),
  ('focus',    'Focus'),
  ('ada',      'Ada'),
  ('subjects', 'Subjects'),
  ('mood',     'Mood'),
  ('streaks',  'Streaks'),
  ('sharing',  'Sharing'),
  ('other',    'Other')
on conflict (key) do nothing;

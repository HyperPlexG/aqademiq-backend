-- Ada durable memory.
--
-- Until now Ada's only memory was the last 16 rows of `ada_messages` for the
-- CURRENT session, replayed as plain text. A new conversation therefore started
-- from nothing: everything the user had already explained about how they work
-- had to be re-explained. `ada_sessions.context` existed for this and was never
-- written.
--
-- This table is the durable half. It holds a small number of stable facts per
-- user — how they prefer to work, hard constraints on their week, patterns worth
-- acting on — not a log of what was said. It is deliberately NOT an embedding
-- store: retrieval is by kind/recency/subject, which costs a single indexed
-- query, whereas semantic recall would mean an embedding call on every turn and
-- the provider pool is the free tier we are trying not to exhaust. Volume per
-- user is dozens of rows, so exact retrieval is sufficient; pgvector stays a
-- later option if that assumption ever breaks.
--
-- Memories are Ada's notes about the user, not the user's own data, so writing
-- one does NOT go through the ada_pending_actions confirmation gate — asking
-- permission to remember a preference would bury the real proposals. They are
-- instead visible and individually deletable, and `source` records whether the
-- user said it outright or Ada inferred it.

create table if not exists "ada_memories" (
    "id"         uuid not null default gen_random_uuid(),
    "user_id"    uuid not null,
    -- preference  how they like to work ("prefers deep work before noon")
    -- constraint  a hard limit on their week ("lab every Tuesday 2-5pm")
    -- pattern     something observed repeatedly ("abandons sessions over 90min")
    -- goal        what they are working toward ("wants a 9 CGPA this semester")
    -- fact        durable context that fits nowhere else ("dyslexic, needs audio")
    "kind"       varchar(20) not null,
    "content"    text not null,
    -- Set when the memory only applies to one subject; null = applies broadly.
    "subject_id" uuid,
    -- 'user' = they stated it. 'ada' = inferred from behaviour, so weaker.
    "source"     varchar(10) not null default 'ada',
    -- 1–5. Inferences start low; something stated outright starts high.
    "confidence" smallint not null default 3,
    -- Retrieval telemetry: lets a later pass drop memories nothing ever uses.
    "use_count"    integer not null default 0,
    "last_used_at" timestamptz,
    -- For memories that are only true for a while ("exam week starts 12 Aug").
    -- Retrieval filters expired rows rather than deleting them, so the history
    -- survives for audit.
    "expires_at" timestamptz,
    "created_at" timestamptz not null default current_timestamp,
    "updated_at" timestamptz not null default current_timestamp,
    constraint "ada_memories_pkey" primary key ("id"),
    constraint "ada_memories_subject_fkey" foreign key ("subject_id")
        references "courses" ("id") on delete cascade,
    constraint "ada_memories_kind_check"
        check ("kind" in ('preference', 'constraint', 'pattern', 'goal', 'fact')),
    constraint "ada_memories_source_check"
        check ("source" in ('user', 'ada')),
    constraint "ada_memories_confidence_check"
        check ("confidence" between 1 and 5)
);

-- The retrieval path: "this user's live memories, strongest first".
create index if not exists "ada_memories_user_idx" on "ada_memories" ("user_id");
create index if not exists "ada_memories_user_kind_idx" on "ada_memories" ("user_id", "kind");
create index if not exists "ada_memories_subject_idx" on "ada_memories" ("subject_id");

-- A floor against the obvious failure mode: the agent re-remembering the same
-- sentence every conversation until the context block is nothing but duplicates.
-- The service layer also looks for a near-match and updates instead of inserting;
-- this catches the exact-repeat case even if that check is bypassed.
create unique index if not exists "ada_memories_user_content_key"
    on "ada_memories" ("user_id", lower("content"));

alter table "ada_memories" enable row level security;

drop policy if exists "ada_memories_own" on "ada_memories";
create policy "ada_memories_own" on "ada_memories"
    for all to authenticated
    using ("user_id" = auth.uid())
    with check ("user_id" = auth.uid());

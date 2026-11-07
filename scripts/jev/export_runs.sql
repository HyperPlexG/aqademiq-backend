-- Past Ada chat runs, for the offline Jev replay (scripts/jev/replay.ts).
--
-- Read-only. Run it in the Supabase SQL editor (or via the MCP execute_sql
-- tool), save the single JSON value it returns as runs.json, and keep that
-- file OUT of the repo: it holds students' messages. Tags and subjects are the
-- student's current ones, not as they were at the time of the run.

with runs as (
  select r.id, r.user_id, r.goal, r.created_at, r.scratchpad->>0 as tier_line
  from ada_agent_runs r
  where r.trigger_message_id is not null
    and r.created_at > now() - interval '60 days'
)
select coalesce(json_agg(json_build_object(
  'run_id', r.id,
  'created_at', r.created_at,
  'goal', r.goal,
  'tier_line', r.tier_line,
  'reply', (select m.content from ada_messages m
            where m.role = 'assistant' and m.metadata->>'run_id' = r.id::text
            order by m.sent_at limit 1),
  'tags', (select coalesce(json_agg(json_build_object('id', t.id, 'label', t.name) order by t.created_at), '[]'::json)
           from study_tags t where t.user_id = r.user_id),
  'subjects', (select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name) order by c.sort_order), '[]'::json)
               from courses c where c.user_id = r.user_id and not c.is_archived),
  'proposals', (select coalesce(json_agg(json_build_object(
                   'id', a.id, 'tool', a.tool_name, 'title', a.title, 'args', a.args, 'status', a.status)
                   order by a.created_at), '[]'::json)
                from ada_pending_actions a where a.run_id = r.id)
) order by r.created_at), '[]'::json) as runs
from runs r;

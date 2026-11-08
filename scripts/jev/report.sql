-- How Jev in shadow compares with Ada, from live traffic (ada_jev_shadow).
-- Read-only. The cards' fate is the ground truth: a card Jev thought the
-- student never asked for (named <= 0.3) that the student then declined is a
-- catch; one they approved is a false alarm.

-- 1. Volume, speed, cost, failures.
select count(*) as runs,
       count(*) filter (where error is not null) as failed,
       percentile_cont(0.5) within group (order by ms) as p50_ms,
       percentile_cont(0.95) within group (order by ms) as p95_ms,
       sum(cost_usd) as cost_usd
from ada_jev_shadow;

-- 2. Tier: the rules against Jev.
select rule_tier, jev_tier, count(*)
from ada_jev_shadow where error is null
group by 1, 2 order by 1, 2;

-- 3. "Did the student ask for this card?" against what the student did with it.
select case when (c->>'named')::float <= 0.3 then 'jev: not asked'
            when (c->>'named')::float >= 0.7 then 'jev: asked'
            else 'jev: unsure' end as jev,
       a.status as student,
       count(*)
from ada_jev_shadow s
cross join lateral jsonb_array_elements(s.comparison->'cards') c
join ada_pending_actions a on a.id = (c->>'id')::uuid
where s.error is null
group by 1, 2 order by 1, 2;

-- 4. Tag and subject: how often Jev disagrees with the model, and how sure it is.
select 'tag' as field, (c->'tag'->>'agree')::boolean as agree,
       round(avg((c->'tag'->>'confidence')::numeric), 2) as avg_confidence, count(*)
from ada_jev_shadow s cross join lateral jsonb_array_elements(s.comparison->'cards') c
where s.error is null and c ? 'tag' group by 1, 2
union all
select 'subject', (c->'subject'->>'agree')::boolean,
       round(avg((c->'subject'->>'confidence')::numeric), 2), count(*)
from ada_jev_shadow s cross join lateral jsonb_array_elements(s.comparison->'cards') c
where s.error is null and c ? 'subject' group by 1, 2;

# Jev in Ada

Jev is TypeSafe's "System One" decision model: it answers closed questions —
pick one of these, how likely is this to be true — with calibrated
probabilities, many per call, in about 0.1–0.3 s, for $0.042 per million input
tokens (output is free). It cannot write text. Ada's chat model still writes
titles and replies; Jev is for the decisions that model kept getting wrong
(26 Oct 2026: a tag's id passed as a subject, invented tasks, "Assignment"
tags nobody asked for).

## Phase 2a — shadow (what is built)

Jev runs beside every chat run and changes nothing a student sees.

| Piece | Where |
|---|---|
| Client (TypeSafe's System One request shape) | `supabase/functions/_shared/decide.ts` |
| Questions, comparison, background write | `supabase/functions/api/agent/jev_shadow.ts` (+ `_test.ts`) |
| Hook | end of `runAgent` in `agent/runtime.ts`, via `EdgeRuntime.waitUntil` |
| Table | `ada_jev_shadow` — `supabase/migrations/20261107120000_ada_jev_shadow.sql` |
| Live report | `scripts/jev/report.sql` |
| Offline replay of past runs | `scripts/jev/export_runs.sql` → `scripts/jev/replay.ts` |

One call per run asks:

- `tier` — easy / middle / hard, against `chooseTier()`'s rules
- `intent` — question, small talk, add tasks, change tasks, plan, other
- per card (≤ 15): `p<n>_named` "did the student ask for this?", and for task
  cards `p<n>_tag` / `p<n>_subject` (the student's own tags and subjects, or none)
- `reply_true` — does the reply claim only what was proposed?

The ground truth is what the student did with each card: a card Jev scored
"not asked" (≤ 0.3) that the student declined is a catch; one they approved is
a false alarm.

### Secrets

| Secret | Default | |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Turns shadow on. (`JEV_API_KEY` wins if both are set.) |
| `ADA_JEV_SHADOW` | on | `off` stops it without removing the key |
| `JEV_URL` | `https://openrouter.ai/api/v1/systemone` | TypeSafe direct: `https://api.typesafe.ai/v1/systemone` |
| `JEV_MODEL` | `typesafe/jev-1.14` | Pin a version, never an alias: thresholds depend on it |
| `JEV_TIMEOUT_MS` | 5000 | |

Privacy: each call sends the student's message, their tag and subject names,
Ada's cards and reply to OpenRouter (and on to TypeSafe) — the same kind of
data Ada already sends its chat models. Nothing about App freeze is involved.

### Replay

```bash
# 1. Run scripts/jev/export_runs.sql in the SQL editor; save the JSON as
#    ~/jev/runs.json (outside the repo — it holds students' messages).
# 2.
OPENROUTER_API_KEY=… deno run --config supabase/functions/deno.json \
  --allow-read --allow-write --allow-env --allow-net=openrouter.ai \
  scripts/jev/replay.ts ~/jev/runs.json ~/jev/report.md
```

On 7 Nov 2026 the export held 213 runs from the last 60 days, 55 of them with
cards (198 cards).

## Phase 2b — switching decisions over (not built)

Decide per decision, on the shadow and replay numbers, not all at once:

1. **Invented cards.** If "not asked" cards are mostly declined and rarely
   approved, hold a card scoring ≤ 0.3 back from the tray (or mark it "Ada
   added this — keep?").
2. **Tag / subject.** Where Jev confidently (≥ 0.7) disagrees with the model,
   use Jev's pick; in between, leave the field empty rather than guess.
3. **Tier.** Replace `chooseTier()` with Jev's tier when it agrees with how runs
   actually went (escalations, failed runs) better than the rules do.

Thresholds are per model version; re-measure after changing `JEV_MODEL`.

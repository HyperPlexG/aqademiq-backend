// §2.2/§4.2 — /v1/tasks. Port of src/features/tasks/tasks.controller.ts.
// Static routes are declared before `:occ` so they aren't shadowed by the
// dynamic occurrence-id param (same ordering as the Nest controller).
import { Hono } from 'hono';
import {
  type BreakdownDto,
  type CreateTaskDto,
  type MoveTasksDto,
  type PatchTaskDto,
  type QueryTasksDto,
  type RepeatRuleDto,
  tasksService,
  type ToggleTaskDto,
} from '../services/tasks.service.ts';
import { HttpError } from '../../_shared/http.ts';
import { type Body, jsonBody, num, str } from '../../_shared/validate.ts';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PART_OF_DAY = ['anytime', 'morning', 'afternoon', 'evening'] as const;
const REPEAT_KINDS = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'everyNDays', 'everyNWeeks', 'everyNMonths'] as const;

export const tasksRouter = new Hono();

// GET /tasks/history/completions
tasksRouter.get('/history/completions', async (c) => c.json(await tasksService.completions()));

// GET /tasks?date= | ?from=&to=
tasksRouter.get('/', async (c) => {
  const q: QueryTasksDto = {
    date: matchYmd(c.req.query('date'), 'date'),
    from: matchYmd(c.req.query('from'), 'from'),
    to: matchYmd(c.req.query('to'), 'to'),
  };
  return c.json(await tasksService.query(q));
});

// POST /tasks
tasksRouter.post('/', async (c) => {
  const b = await jsonBody(c.req);
  const dto: CreateTaskDto = {
    title: str(b, 'title', true)!,
    subject_id: str(b, 'subject_id', false),
    duration_seconds: num(b, 'duration_seconds', false, { int: true, min: 0 }),
    scheduled_at: str(b, 'scheduled_at', false),
    category: str(b, 'category', false),
    note: str(b, 'note', false),
    date: str(b, 'date', false, { pattern: YMD }),
    repeat: parseRepeat(b),
    until_date: str(b, 'until_date', false, { pattern: YMD }),
    part_of_day: str(b, 'part_of_day', false, { enum: PART_OF_DAY }),
  };
  return c.json(await tasksService.create(dto), 201);
});

// POST /tasks/move
tasksRouter.post('/move', async (c) => {
  const b = await jsonBody(c.req);
  const dto: MoveTasksDto = {
    from: str(b, 'from', true, { pattern: YMD })!,
    to: str(b, 'to', true, { pattern: YMD })!,
    ids: parseIds(b),
  };
  return c.json(await tasksService.move(dto), 201);
});

// PATCH /tasks/:occ/toggle
tasksRouter.patch('/:occ/toggle', async (c) => {
  const q: ToggleTaskDto = { date: matchYmd(c.req.query('date'), 'date') };
  return c.json(await tasksService.toggle(c.req.param('occ'), q));
});

// POST /tasks/:occ/breakdown
tasksRouter.post('/:occ/breakdown', async (c) => {
  const b = await jsonBody(c.req);
  // `steps` is optional: when absent the service generates them, when present
  // (Ada, or a client sending edited ones) they are used as written.
  const rawSteps = (b as Record<string, unknown>).steps;
  const dto: BreakdownDto = {
    date: str(b, 'date', false, { pattern: YMD }),
    steps: Array.isArray(rawSteps)
      ? rawSteps.map((s) => {
        const row = (s ?? {}) as Record<string, unknown>;
        return {
          title: String(row.title ?? ''),
          detail: typeof row.detail === 'string' ? row.detail : undefined,
          duration_seconds: Number(row.duration_seconds) || 0,
        };
      })
      : undefined,
  };
  return c.json(await tasksService.breakdown(c.req.param('occ'), dto), 201);
});

// PATCH /tasks/:occ
tasksRouter.patch('/:occ', async (c) => {
  const b = await jsonBody(c.req);
  const dto: PatchTaskDto = {
    scheduled_at: str(b, 'scheduled_at', false),
    status: str(b, 'status', false, { enum: ['PENDING', 'COMPLETE'] }),
    title: str(b, 'title', false),
    category: str(b, 'category', false),
    note: str(b, 'note', false),
    duration_seconds: num(b, 'duration_seconds', false, { int: true, min: 0 }),
    part_of_day: str(b, 'part_of_day', false, { enum: PART_OF_DAY }),
  };
  return c.json(await tasksService.patch(c.req.param('occ'), dto));
});

// DELETE /tasks/:occ
tasksRouter.delete('/:occ', async (c) => c.json(await tasksService.remove(c.req.param('occ'))));

// ---- helpers ----

/** Validate a `yyyy-MM-dd` query param (matches @Matches(YMD) on the DTO). */
function matchYmd(v: string | undefined, field: string): string | undefined {
  if (v === undefined) return undefined;
  if (!YMD.test(v)) throw new HttpError(422, `${field} is invalid`);
  return v;
}

/** RepeatRuleDto: { kind ∈ REPEAT_KINDS, interval? int 1..365 }. */
function parseRepeat(b: Body): RepeatRuleDto | undefined {
  const v = b.repeat;
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) throw new HttpError(422, 'repeat must be an object');
  const r = v as Body;
  return {
    kind: str(r, 'kind', true, { enum: REPEAT_KINDS })!,
    interval: num(r, 'interval', false, { int: true, min: 1, max: 365 }),
  };
}

/** MoveTasksDto.ids?: string[] (each a string). */
function parseIds(b: Body): string[] | undefined {
  const v = b.ids;
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new HttpError(422, 'ids must be an array');
  return v.map((item, i) => {
    if (typeof item !== 'string') throw new HttpError(422, `ids[${i}] must be a string`);
    return item;
  });
}

// §2.12 — calendar & reminder import (v2). Turns the events and reminders the
// student picked on the device into tasks, skipping anything a previous import
// already put in the plan. The decisions live in import_plan.ts (pure, tested);
// this file only does the reads and writes.
//
// Separate from integrations.service.ts on purpose: that file's ICS / Google
// endpoints write calendar_events rows, which Ada's scheduler counts as busy
// time. These imports are tasks, so they must not land there as well — see the
// header of import_plan.ts.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { cacheDel } from '../../_shared/redis.ts';
import { revision } from '../../_shared/revision.ts';
import {
  type CheckRequest,
  classifyExisting,
  type ExistingImportRow,
  importKey,
  IMPORTED_TASK_SOURCE,
  type ImportRequest,
  planImport,
  taskRowFor,
  UNTAGGED_CATEGORY,
} from './import_plan.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The batch's tag, resolved the way tasksService.create resolves `category`:
 * a study-tag id is kept, a label is matched to its tag by name, anything else
 * passes through. Resolved once per request rather than once per item.
 */
async function resolveCategory(category: string | null): Promise<string> {
  const trimmed = category?.trim() ?? '';
  if (!trimmed) return UNTAGGED_CATEGORY;
  if (UUID_RE.test(trimmed)) {
    const byId = await tenantDb().studyTag.findFirst({ where: { id: trimmed } });
    return byId?.id ?? trimmed;
  }
  const byName = await tenantDb().studyTag.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  });
  return byName?.id ?? trimmed;
}

/**
 * Every task this user already imported under any of [keys], deleted ones
 * included (status `cancelled`), so the caller can tell the two apart.
 *
 * The keys travel as one JSON array parameter rather than a Postgres array: a
 * plain text parameter needs nothing from the driver adapter.
 */
async function findImported(keys: string[]): Promise<ExistingImportRow[]> {
  if (keys.length === 0) return [];
  return await prismaBase().$queryRawUnsafe<ExistingImportRow[]>(
    `select id::text as id, status, metadata->>'import_key' as import_key
       from tasks
      where user_id = $1::uuid
        and source = $3
        and metadata->>'import_key' in (select jsonb_array_elements_text($2::jsonb))`,
    RequestContext.userId,
    JSON.stringify(keys),
    IMPORTED_TASK_SOURCE,
  );
}

export const calendarImportService = {
  /** POST /integrations/import */
  async importItems(req: ImportRequest) {
    const userId = RequestContext.userId;
    const existingRows = await findImported(req.items.map((i) => importKey(req.source, i.external_id)));
    const plan = planImport(req.source, req.items, existingRows);

    const rows: Array<ReturnType<typeof taskRowFor>> = [];
    if (plan.create.length > 0) {
      const category = await resolveCategory(req.category);
      for (const item of plan.create) {
        rows.push(taskRowFor(item, { id: crypto.randomUUID(), userId, category, source: req.source }));
      }
      // One statement for the whole batch: a 100-class timetable is one round
      // trip, not 100 (tasksService.create also does two Redis calls per task).
      // createMany bypasses the tenant extension, so user_id is set explicitly
      // in every row by taskRowFor.
      // deno-lint-ignore no-explicit-any
      await prismaBase().task.createMany({ data: rows as any });
      // Same invalidation tasksService.create does, once for the batch: other
      // devices refresh on the revision bump.
      await cacheDel(`tasks:completions:${userId}`);
      await revision.bump(userId, 'tasks');
    }

    return {
      status: 'imported',
      source: req.source,
      imported: rows.length,
      skipped: plan.existing.length + plan.duplicates,
      results: [
        ...rows.map((r) => ({ external_id: r.metadata.external_id, status: 'imported', task_id: r.id })),
        ...plan.existing.map((e) => ({ external_id: e.item.external_id, status: 'already_imported', task_id: e.task_id })),
      ],
    };
  },

  /** POST /integrations/import/check */
  async check(req: CheckRequest) {
    const rows = await findImported(req.external_ids.map((id) => importKey(req.source, id)));
    return { source: req.source, ...classifyExisting(req.source, req.external_ids, rows) };
  },
};

#!/usr/bin/env node
// Merge the hand-maintained edge overlay into the generated OpenAPI spec, then
// sync the result to every copy of the contract.
//
// Why this exists: openapi.json is produced by booting the NestJS app
// (EMIT_OPENAPI=1), but the deployed backend is the Deno/Hono tree. Several
// endpoints live only there — Ada's confirmation gate and durable memory have no
// NestJS counterpart, since src/features/ada/ still holds the older single-shot
// propose_plan design. Editing openapi.json by hand to add them does not survive
// the next regeneration, which is precisely how the pending-action routes came to
// be missing from a contract the frontend was building against.
//
// The contract also exists byte-identical in three places (CLAUDE.md), and
// keeping them in step by hand is a silent-drift bug waiting to happen. So this
// merges and syncs in one step.
//
//   node scripts/merge-openapi.mjs [--check]
//
// --check verifies everything is already merged and in sync without writing,
// which is what CI wants.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const GENERATED = resolve(root, 'openapi.json');
const OVERLAY = resolve(root, 'openapi.edge-overlay.json');

/** Every copy of the contract that must end up identical. */
const TARGETS = [
  GENERATED,
  resolve(root, 'backend_contract/openapi.json'),
  resolve(root, '../aqademiq-frontend/backend_contract/openapi.json'),
];

const checkOnly = process.argv.includes('--check');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const spec = readJson(GENERATED);
const overlay = readJson(OVERLAY);

// Overlay wins, per HTTP method rather than per path: a path can be partly
// generated and partly hand-written (e.g. GET from NestJS, DELETE edge-only), and
// replacing the whole path object would drop the generated half.
let addedPaths = 0;
let replacedOps = 0;
for (const [path, ops] of Object.entries(overlay.paths ?? {})) {
  if (!spec.paths[path]) {
    spec.paths[path] = {};
    addedPaths++;
  }
  for (const [method, op] of Object.entries(ops)) {
    if (spec.paths[path][method]) replacedOps++;
    spec.paths[path][method] = op;
  }
}

spec.components ??= {};
spec.components.schemas ??= {};
let addedSchemas = 0;
for (const [name, schema] of Object.entries(overlay.components?.schemas ?? {})) {
  if (!spec.components.schemas[name]) addedSchemas++;
  spec.components.schemas[name] = schema;
}

// Sorted so the diff of a regeneration is about content, not key order.
spec.paths = Object.fromEntries(Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b)));

const serialised = `${JSON.stringify(spec, null, 2)}\n`;

let drifted = false;
for (const target of TARGETS) {
  if (!existsSync(target)) {
    // The frontend repo is a sibling checkout and may simply not be present (CI
    // clones one repo). Not an error — just report it, so a missing sync is
    // visible rather than assumed done.
    console.warn(`skip (not present): ${target}`);
    continue;
  }
  const current = readFileSync(target, 'utf8');
  if (current === serialised) continue;
  drifted = true;
  if (checkOnly) {
    console.error(`out of date: ${target}`);
  } else {
    writeFileSync(target, serialised);
    console.log(`written: ${target}`);
  }
}

console.log(
  `overlay: +${addedPaths} paths, ${replacedOps} operations overridden, +${addedSchemas} schemas | ` +
    `spec now has ${Object.keys(spec.paths).length} paths`,
);

if (checkOnly && drifted) {
  console.error('\nRun `npm run openapi:sync` and commit the result.');
  process.exit(1);
}

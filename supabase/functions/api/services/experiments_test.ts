// Tests for randomized assignment (ANALYTICS_INVESTOR_METRICS §2.7 / §4.3).
//
// These properties are the experiment. If bucketing is not stable, users drift
// between arms and the intent-to-treat estimate is diluted toward zero while
// still looking like a clean number. If two experiments bucket identically,
// their effects cannot be separated. Neither failure throws.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { bucketFor, PRISM_HOLDOUT } from './experiments.service.ts';

const USERS = [
  '14605591-ffd4-4220-873f-9461beaedc80',
  '9c1e4a70-2f83-4b16-8d55-6a7c0e3b9f21',
  'b47d2e19-8c60-4f35-a1e8-3d92f7c45a6b',
  'e82c6d47-9a15-4b38-8e60-2c7f1b94d3a5',
];

Deno.test('the same user always lands in the same bucket', async () => {
  // Stability is the whole design: a user who moves between arms belongs to
  // neither, and the comparison quietly measures nothing.
  for (const u of USERS) {
    const first = await bucketFor(PRISM_HOLDOUT, u);
    for (let i = 0; i < 5; i++) {
      assertEquals(await bucketFor(PRISM_HOLDOUT, u), first, `user ${u} drifted`);
    }
  }
});

Deno.test('buckets are within 0-999', async () => {
  for (const u of USERS) {
    const b = await bucketFor(PRISM_HOLDOUT, u);
    assert(b >= 0 && b <= 999, `bucket ${b} out of range`);
    assert(Number.isInteger(b));
  }
});

Deno.test('a different experiment buckets the same user differently', async () => {
  // Keyed on the experiment as well as the user so two experiments do not hold
  // out the same unlucky people, which would confound both.
  let differed = 0;
  for (const u of USERS) {
    const a = await bucketFor(PRISM_HOLDOUT, u);
    const b = await bucketFor('some_other_experiment_v1', u);
    if (a !== b) differed++;
  }
  assert(differed >= USERS.length - 1, 'experiments are bucketing in lockstep');
});

Deno.test('assignment is spread, not clustered', async () => {
  // A hash that concentrated users would make the holdout the wrong size while
  // still being perfectly stable — stability alone is not enough.
  const seen = new Set<number>();
  for (let i = 0; i < 300; i++) {
    seen.add(await bucketFor(PRISM_HOLDOUT, `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`));
  }
  // 300 draws over 1000 buckets; collisions are expected, clustering is not.
  assert(seen.size > 200, `only ${seen.size} distinct buckets from 300 users`);
});

Deno.test('the holdout is close to the intended 4%', async () => {
  // §4.3 asks for 3-5%. Checked on a large synthetic population because the
  // rate, not the individual assignment, is what the power calculation assumes.
  let held = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    const b = await bucketFor(PRISM_HOLDOUT, `11111111-0000-4000-8000-${String(i).padStart(12, '0')}`);
    if (b < 40) held++;
  }
  const pct = (held / n) * 100;
  assert(pct >= 2.5 && pct <= 5.5, `holdout landed at ${pct.toFixed(2)}%, outside 3-5%`);
});

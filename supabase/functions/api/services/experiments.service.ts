// Randomized experiment assignment (ANALYTICS_INVESTOR_METRICS §2.7 / §4.3).
//
// One rule shapes this file: assignment is **per user and permanent**. The
// causal claim in §4.3 is an intent-to-treat comparison between users, so a
// user who is sometimes held out and sometimes not belongs to neither arm and
// silently dilutes the estimate toward zero. That is why nothing here takes the
// decision from the client, and why the bucket is persisted rather than
// recomputed — a later change to the hash or the boundaries must show up as a
// migration, not as history quietly re-randomising itself.
import { prismaBase } from '../../_shared/prisma.ts';

/** The Prism holdout: these users run focus sessions with the soundscape cut. */
export const PRISM_HOLDOUT = 'prism_actuation_v1';

/**
 * Share held out, in buckets per thousand.
 *
 * §4.3 asks for 3–5%. 40/1000 sits mid-range: large enough to be worth
 * powering, small enough that the cost is ~4% of users getting a slightly worse
 * product.
 */
const HOLDOUT_BUCKETS = 40;

export type Variant = 'control' | 'treatment' | 'holdout';

/**
 * Deterministic bucket 0–999 from (experiment, user).
 *
 * Keyed on the experiment as well as the user so two experiments do not hold
 * out the same unlucky people — otherwise their effects become impossible to
 * separate.
 */
export async function bucketFor(experimentKey: string, userId: string): Promise<number> {
  const data = new TextEncoder().encode(`${experimentKey}:${userId}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new DataView(digest).getUint32(0) % 1000;
}

/**
 * The user's variant, assigning them on first ask.
 *
 * Best-effort by design: if the write fails, the computed variant is still
 * returned, because a database hiccup must not change which arm someone is in.
 * The hash is the source of truth; the row is the audit trail.
 */
export async function variantFor(experimentKey: string, userId: string): Promise<Variant> {
  const bucket = await bucketFor(experimentKey, userId);
  const variant: Variant = bucket < HOLDOUT_BUCKETS ? 'holdout' : 'treatment';

  try {
    const existing = await prismaBase().experimentAssignment.findFirst({
      where: { user_id: userId, experiment_key: experimentKey },
      select: { variant: true },
    });
    if (existing) return existing.variant as Variant;

    await prismaBase().experimentAssignment.create({
      data: { user_id: userId, experiment_key: experimentKey, variant, bucket },
    });
  } catch {
    // Either a race on the unique index or the table being unavailable. The
    // hash gives the same answer either way.
  }
  return variant;
}

/** True when this user's Prism audio is deliberately cut for the experiment. */
export async function isPrismHeldOut(userId: string): Promise<boolean> {
  return (await variantFor(PRISM_HOLDOUT, userId)) === 'holdout';
}

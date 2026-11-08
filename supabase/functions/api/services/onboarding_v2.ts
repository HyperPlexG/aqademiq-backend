// Onboarding v2 (design v11): "How did you hear about us?" and Study hours.
//
// Pure parsing and the one write, kept apart from onboarding.service.ts so the
// rules are testable without a database (onboarding_v2_test.ts).
//
// The write is best-effort and happens after onboarding's transaction: the
// columns arrive with 20261104120000_onboarding_v2_source_and_study_hours.sql,
// and a function deployed before that migration must still complete
// onboarding — it only drops these two answers. That is also why the columns
// are not in prisma/schema.prisma (see the comment there).
import { HttpError } from '../../_shared/http.ts';

/** The ob-source chips, as stored. Order matches the design. */
export const HEARD_FROM = [
  'friend', // A friend or classmate
  'tiktok',
  'instagram',
  'youtube',
  'reddit',
  'ai_assistant', // ChatGPT, Claude or Gemini
  'app_store',
  'google', // Google search
  'school', // School or uni
  'discord',
  'other',
] as const;

export type HeardFrom = (typeof HEARD_FROM)[number];

export interface StudyHoursDto {
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  days: number[];
  /** Minutes after local midnight; until <= from runs overnight. */
  from_min: number;
  until_min: number;
}

export interface OnboardingV2Dto {
  heard_from?: HeardFrom;
  heard_from_other?: string;
  study_hours?: StudyHoursDto;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Validates the v2 fields of POST /onboarding/complete. Absent → undefined. */
export function parseOnboardingV2(b: Record<string, unknown>): OnboardingV2Dto {
  const out: OnboardingV2Dto = {};

  const heard = b['heard_from'];
  if (heard !== undefined && heard !== null) {
    if (typeof heard !== 'string' || !(HEARD_FROM as readonly string[]).includes(heard)) {
      throw new HttpError(422, `heard_from must be one of ${HEARD_FROM.join(', ')}`);
    }
    out.heard_from = heard as HeardFrom;
  }

  const other = b['heard_from_other'];
  if (other !== undefined && other !== null) {
    if (typeof other !== 'string') throw new HttpError(422, 'heard_from_other must be a string');
    const text = other.trim();
    if (text.length > 60) throw new HttpError(422, 'heard_from_other must be at most 60 characters');
    if (text.length > 0) {
      // "Optional. A word or two is plenty." — and only for Other.
      if (out.heard_from !== 'other') throw new HttpError(422, 'heard_from_other is only for heard_from = other');
      out.heard_from_other = text;
    }
  }

  const sh = b['study_hours'];
  if (sh !== undefined && sh !== null) {
    if (typeof sh !== 'object' || Array.isArray(sh)) throw new HttpError(422, 'study_hours must be an object');
    const s = sh as Record<string, unknown>;
    const days = s['days'];
    if (!Array.isArray(days) || days.length === 0 || !days.every((d) => isInt(d) && d >= 1 && d <= 7)) {
      throw new HttpError(422, 'study_hours.days must be a non-empty list of weekdays 1-7');
    }
    const from = s['from_min'];
    const until = s['until_min'];
    if (!isInt(from) || from < 0 || from > 1439) throw new HttpError(422, 'study_hours.from_min must be 0-1439');
    if (!isInt(until) || until < 0 || until > 1440) throw new HttpError(422, 'study_hours.until_min must be 0-1440');
    if (until === from) throw new HttpError(422, 'study_hours must not start and end at the same time');
    out.study_hours = {
      days: [...new Set(days as number[])].sort((a, b) => a - b),
      from_min: from,
      until_min: until,
    };
  }
  return out;
}

/** The parameterised update, or null when there is nothing to write. */
export function onboardingV2Update(userId: string, dto: OnboardingV2Dto): { sql: string; params: unknown[] } | null {
  if (dto.heard_from === undefined && dto.study_hours === undefined) return null;
  const sets: string[] = [];
  const params: unknown[] = [userId];
  const add = (col: string, value: unknown, cast = '') => {
    params.push(value);
    sets.push(`${col} = $${params.length}${cast}`);
  };
  if (dto.heard_from !== undefined) {
    add('heard_from', dto.heard_from);
    add('heard_from_other', dto.heard_from_other ?? null);
  }
  if (dto.study_hours !== undefined) {
    add('study_days', dto.study_hours.days, '::smallint[]');
    add('study_from_min', dto.study_hours.from_min);
    add('study_until_min', dto.study_hours.until_min);
  }
  return {
    sql: `update user_profiles set ${sets.join(', ')}, updated_at = now() where user_id = $1::uuid`,
    params,
  };
}

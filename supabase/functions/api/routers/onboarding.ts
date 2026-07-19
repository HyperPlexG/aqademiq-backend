// §2.1 — /v1/onboarding. Port of onboarding.controller.ts.
import { Hono } from 'hono';
import { onboardingService, type CompleteOnboardingDto, type OnboardingSemesterDto, type OnboardingSubjectDto } from '../services/onboarding.service.ts';
import { jsonBody, str, num, bool } from '../../_shared/validate.ts';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

// deno-lint-ignore no-explicit-any
function parseSemester(v: unknown): OnboardingSemesterDto | undefined {
  if (v === undefined || v === null) return undefined;
  const s = v as Record<string, unknown>;
  return {
    name: str(s, 'name', true, { min: 1, max: 120 })!,
    start: str(s, 'start', true, { pattern: YMD })!,
    end: str(s, 'end', true, { pattern: YMD })!,
  };
}

function parseSubjects(v: unknown): OnboardingSubjectDto[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const s = raw as Record<string, unknown>;
    return {
      name: str(s, 'name', true, { min: 1, max: 120 })!,
      color_hex: str(s, 'color_hex', false, { pattern: HEX }),
      mood: num(s, 'mood', false, { int: true, min: 0, max: 4 }),
      syllabus_staging_key: str(s, 'syllabus_staging_key', false),
      syllabus_file_name: str(s, 'syllabus_file_name', false, { max: 255 }),
      syllabus_mime_type: str(s, 'syllabus_mime_type', false),
    };
  });
}

export const onboardingRouter = new Hono();

onboardingRouter.post('/complete', async (c) => {
  const b = await jsonBody(c.req);
  const dto: CompleteOnboardingDto = {
    consent_given: bool(b, 'consent_given', true)!,
    consent_version: str(b, 'consent_version', false, { min: 1, max: 100 }),
    age: num(b, 'age', true, { int: true, min: 1, max: 120 })!,
    referral_code: str(b, 'referral_code', false),
    name: str(b, 'name', false, { max: 120 }),
    education_level: str(b, 'education_level', false),
    semester: parseSemester(b['semester']),
    subjects: parseSubjects(b['subjects']),
    daily_focus_goal_min: num(b, 'daily_focus_goal_min', false, { int: true, min: 0, max: 1440 }),
    work_best_times: b['work_best_times'],
  };
  return c.json(await onboardingService.complete(dto), 201);
});

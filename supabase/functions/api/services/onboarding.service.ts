// §2.1 — post-registration setup flow. Port of src/features/onboarding/onboarding.service.ts.
// Uses the raw client (prismaBase) exactly like the Nest source, which passes
// user_id explicitly on every write.
import { prismaBase } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { revision } from '../../_shared/revision.ts';

const DEFAULT_PALETTE = ['#4F8DFD', '#7C5CFC', '#FF5C7C', '#FFA53C', '#34C759', '#00B8D9', '#8E8E93', '#FF6633'];

// Legal minimum age to complete onboarding (data-use consent gate).
const MIN_AGE = 18;

export interface OnboardingSubjectDto {
  name: string;
  color_hex?: string;
  mood?: number;
  syllabus_staging_key?: string;
  syllabus_file_name?: string;
  syllabus_mime_type?: string;
}

export interface OnboardingSemesterDto {
  name: string;
  start: string;
  end: string;
}

export interface CompleteOnboardingDto {
  consent_given: boolean;
  consent_version?: string;
  age: number;
  referral_code?: string;
  name?: string;
  education_level?: string;
  semester?: OnboardingSemesterDto;
  subjects?: OnboardingSubjectDto[];
  daily_focus_goal_min?: number;
  work_best_times?: unknown;
}

function date(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function dateTime(timeStr: string): Date {
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusMonthsYmd(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function summary(userId: string) {
  const [profile, terms, courses] = await Promise.all([
    prismaBase().userProfile.findUnique({ where: { user_id: userId } }),
    prismaBase().academicTerm.findMany({ where: { user_id: userId } }),
    prismaBase().course.findMany({ where: { user_id: userId } }),
  ]);
  return {
    profile_name: profile ? 'User' : null,
    semesters: terms.length,
    subjects: courses.length,
    daily_focus_goal_min: profile?.daily_focus_goal_mins ?? null,
  };
}

export const onboardingService = {
  async complete(dto: CompleteOnboardingDto) {
    const userId = RequestContext.userId;

    // Consent gate — reject before ANY write so onboarding cannot complete
    // without data-use consent. consent_timestamp is stamped server-side below.
    if (dto.consent_given !== true) {
      throw new HttpError(403, 'Consent is required to complete onboarding');
    }
    // Legal minimum-age gate (age itself is bounds-checked 1..120 by the DTO).
    if (dto.age < MIN_AGE) {
      throw new HttpError(403, `You must be at least ${MIN_AGE} years old to complete onboarding`);
    }

    const existingCourse = await prismaBase().course.findFirst({ where: { user_id: userId } });
    if (existingCourse) {
      return { ...(await summary(userId)), status: 'already_completed' };
    }

    // Validate the referral code up front (if one was entered) so a typo is
    // rejected before we provision anything, rather than silently ignored.
    const referralCodeInput = dto.referral_code?.trim();
    let referralCodeRow: { id: string; user_id: string } | null = null;
    if (referralCodeInput) {
      referralCodeRow = await prismaBase().referralCode.findUnique({
        where: { code: referralCodeInput.toUpperCase() },
      });
      if (!referralCodeRow) throw new HttpError(422, 'Invalid referral code');
      if (referralCodeRow.user_id === userId) {
        throw new HttpError(400, 'You cannot use your own referral code');
      }
    }

    const sem = dto.semester ?? { name: 'My Semester', start: todayYmd(), end: plusMonthsYmd(6) };

    // deno-lint-ignore no-explicit-any
    await prismaBase().$transaction(async (tx: any) => {
      const profileData: Record<string, unknown> = {
        onboarding_complete: true,
        // Consent recorded here; timestamp is server-side (client value ignored).
        consent_given: true,
        consent_timestamp: new Date(),
        consent_version: dto.consent_version ?? null,
        age: dto.age,
      };
      if (dto.name !== undefined) {
        profileData.full_name = dto.name;
        profileData.display_name = dto.name;
      }
      await tx.profile.update({ where: { id: userId }, data: profileData });

      await tx.userProfile.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          study_level: dto.education_level ?? null,
          daily_focus_goal_mins: dto.daily_focus_goal_min ?? 60,
          onboarding_completed_at: new Date(),
        },
        update: {
          study_level: dto.education_level ?? undefined,
          daily_focus_goal_mins: dto.daily_focus_goal_min ?? undefined,
          onboarding_completed_at: new Date(),
        },
      });

      const term = await tx.academicTerm.create({
        data: {
          user_id: userId,
          name: sem.name,
          start_date: date(sem.start),
          end_date: date(sem.end),
          is_current: true,
        },
      });

      const subjects = dto.subjects ?? [];
      for (let i = 0; i < subjects.length; i++) {
        const s = subjects[i];
        const course = await tx.course.create({
          data: {
            user_id: userId,
            term_id: term.id,
            name: s.name,
            color: s.color_hex ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
            sort_order: i,
            subject_feeling: s.mood ?? 3,
            professor: '',
            grade_system: 'letter',
          },
        });

        if (s.syllabus_staging_key) {
          await tx.subjectMaterial.create({
            data: {
              user_id: userId,
              course_id: course.id,
              file_name: s.syllabus_file_name ?? 'Syllabus',
              material_type: 'syllabus',
              file_url: s.syllabus_staging_key,
              processing_status: 'ready',
              mime_type: s.syllabus_mime_type ?? null,
            },
          });
        }
      }

      await tx.userAppSettings.upsert({
        where: { user_id: userId },
        create: { user_id: userId, appearance: 'system' },
        update: {},
      });

      await tx.notificationPreferences.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          morning_checkin_time: dateTime('08:00'),
          evening_review_time: dateTime('20:00'),
          weekly_review_time: dateTime('15:00'),
        },
        update: {},
      });
    });

    // Attribute the referral now that the account is provisioned (best-effort —
    // the code was already validated above; ignore a duplicate redemption).
    if (referralCodeRow) {
      try {
        const already = await prismaBase().referralRedemption.findUnique({
          where: { referred_user_id: userId },
        });
        if (!already) {
          await prismaBase().referralRedemption.create({
            data: {
              referral_code_id: referralCodeRow.id,
              referred_user_id: userId,
            },
          });
        }
      } catch (_) {
        // Non-fatal: onboarding is complete regardless of referral bookkeeping.
      }
    }

    await revision.bump(userId, 'onboarding');
    return { ...(await summary(userId)), status: 'completed' };
  },
};

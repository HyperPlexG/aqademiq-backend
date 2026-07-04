import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { RevisionService } from '../../infra/revision.service';
import { CompleteOnboardingDto } from './dto/onboarding.dto';

const DEFAULT_PALETTE = ['#4F8DFD', '#7C5CFC', '#FF5C7C', '#FFA53C', '#34C759', '#00B8D9', '#8E8E93', '#FF6633'];

/**
 * §2.1 — atomic, idempotent onboarding completion. Creates profile + semester +
 * subjects + settings in a single transaction. Idempotent: if the user already
 * has subjects, it returns the current state without duplicating (pair with an
 * Idempotency-Key header for retry-safe replay).
 *
 * TODO(§2.5): trigger the initial Ada plan (async) once Vertex AI is wired.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly rev: RevisionService,
  ) {}

  async complete(dto: CompleteOnboardingDto) {
    const userId = this.rc.userId;

    // Idempotency: already onboarded (has a non-deleted subject) → return state.
    const existingSubject = await this.prisma.subject.findFirst({ where: { user_id: userId, deleted_at: null } });
    if (existingSubject) {
      return { ...(await this.summary(userId)), status: 'already_completed' };
    }

    const sem = dto.semester ?? { name: 'My Semester', start: this.todayYmd(), end: this.plusMonthsYmd(6) };

    await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.userProfile.upsert({
          where: { user_id: userId },
          create: { user_id: userId, name: dto.name },
          update: { name: dto.name },
        });
      }

      const semester = await tx.semester.create({
        data: { user_id: userId, name: sem.name, start: this.date(sem.start), end: this.date(sem.end), is_current: true },
      });

      const subjects = dto.subjects ?? [];
      for (let i = 0; i < subjects.length; i++) {
        const s = subjects[i];
        const subject = await tx.subject.create({
          data: {
            user_id: userId,
            semester_id: semester.id,
            name: s.name,
            color_hex: s.color_hex ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
            sort_order: i,
            ...(s.mood !== undefined ? { mood: s.mood } : {}),
          },
        });

        // ob3 — syllabus staged via `POST /uploads/staging/init` before this
        // subject existed; attach it now that the subject has an id.
        if (s.syllabus_staging_key) {
          await tx.subjectFile.create({
            data: {
              subject_id: subject.id,
              name: s.syllabus_file_name ?? 'Syllabus',
              kind: 'syllabus',
              s3_key: s.syllabus_staging_key,
              mime_type: s.syllabus_mime_type ?? null,
              scan_status: 'clean',
            },
          });
          await tx.subject.update({ where: { id: subject.id }, data: { files_count: { increment: 1 } } });
        }
      }

      await tx.settingsPrefs.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          ...(dto.daily_focus_goal_min !== undefined ? { daily_focus_goal_min: dto.daily_focus_goal_min } : {}),
          ...(dto.education_level !== undefined ? { education_level: dto.education_level } : {}),
          ...(dto.work_best_times !== undefined ? { work_best_times: dto.work_best_times as object } : {}),
        },
        update: {
          ...(dto.daily_focus_goal_min !== undefined ? { daily_focus_goal_min: dto.daily_focus_goal_min } : {}),
          ...(dto.education_level !== undefined ? { education_level: dto.education_level } : {}),
          ...(dto.work_best_times !== undefined ? { work_best_times: dto.work_best_times as object } : {}),
        },
      });

      await tx.emailPreferences.upsert({
        where: { user_id: userId },
        create: { user_id: userId },
        update: {},
      });
    });

    await this.rev.bump(userId, 'onboarding');
    // referral_code attribution is deferred to the referrals feature (§2.10 P2).
    return { ...(await this.summary(userId)), status: 'completed' };
  }

  private async summary(userId: string) {
    const [profile, semesters, subjects, settings] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { user_id: userId } }),
      this.prisma.semester.findMany({ where: { user_id: userId, deleted_at: null } }),
      this.prisma.subject.findMany({ where: { user_id: userId, deleted_at: null } }),
      this.prisma.settingsPrefs.findUnique({ where: { user_id: userId } }),
    ]);
    return {
      profile_name: profile?.name ?? null,
      semesters: semesters.length,
      subjects: subjects.length,
      daily_focus_goal_min: settings?.daily_focus_goal_min ?? null,
    };
  }

  private date(ymd: string): Date {
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  private todayYmd(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private plusMonthsYmd(months: number): string {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().slice(0, 10);
  }
}

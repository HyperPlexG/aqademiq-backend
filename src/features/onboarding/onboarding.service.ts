import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { RevisionService } from '../../infra/revision.service';
import { CompleteOnboardingDto } from './dto/onboarding.dto';

const DEFAULT_PALETTE = ['#4F8DFD', '#7C5CFC', '#FF5C7C', '#FFA53C', '#34C759', '#00B8D9', '#8E8E93', '#FF6633'];

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly rev: RevisionService,
  ) {}

  async complete(dto: CompleteOnboardingDto) {
    const userId = this.rc.userId;

    const existingCourse = await this.prisma.course.findFirst({ where: { user_id: userId } });
    if (existingCourse) {
      return { ...(await this.summary(userId)), status: 'already_completed' };
    }

    const sem = dto.semester ?? { name: 'My Semester', start: this.todayYmd(), end: this.plusMonthsYmd(6) };

    await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { full_name: dto.name, display_name: dto.name, onboarding_complete: true },
        });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { onboarding_complete: true },
        });
      }

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
          start_date: this.date(sem.start),
          end_date: this.date(sem.end),
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
          morning_checkin_time: this.dateTime('08:00'),
          evening_review_time: this.dateTime('20:00'),
          weekly_review_time: this.dateTime('15:00'),
        },
        update: {},
      });
    });

    await this.rev.bump(userId, 'onboarding');
    return { ...(await this.summary(userId)), status: 'completed' };
  }

  private async summary(userId: string) {
    const [profile, terms, courses] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { user_id: userId } }),
      this.prisma.academicTerm.findMany({ where: { user_id: userId } }),
      this.prisma.course.findMany({ where: { user_id: userId } }),
    ]);
    return {
      profile_name: profile ? 'User' : null,
      semesters: terms.length,
      subjects: courses.length,
      daily_focus_goal_min: profile?.daily_focus_goal_mins ?? null,
    };
  }

  private date(ymd: string): Date {
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  private dateTime(timeStr: string): Date {
    return new Date(`1970-01-01T${timeStr}:00.000Z`);
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

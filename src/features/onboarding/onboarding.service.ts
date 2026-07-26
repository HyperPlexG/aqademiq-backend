import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { RevisionService } from '../../infra/revision.service';
import { CompleteOnboardingDto } from './dto/onboarding.dto';

const DEFAULT_PALETTE = ['#4F8DFD', '#7C5CFC', '#FF5C7C', '#FFA53C', '#34C759', '#00B8D9', '#8E8E93', '#FF6633'];

// Legal minimum age to complete onboarding (data-use consent gate).
const MIN_AGE = 18;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly rev: RevisionService,
  ) {}

  async complete(dto: CompleteOnboardingDto) {
    const userId = this.rc.userId;

    // Consent gate — reject before ANY write so onboarding cannot complete
    // without data-use consent. consent_timestamp is stamped server-side below.
    if (dto.consent_given !== true) {
      throw new ForbiddenException('Consent is required to complete onboarding');
    }
    // Legal minimum-age gate (age itself is bounds-checked 1..120 by the DTO).
    if (dto.age < MIN_AGE) {
      throw new ForbiddenException(`You must be at least ${MIN_AGE} years old to complete onboarding`);
    }

    const existingCourse = await this.prisma.course.findFirst({ where: { user_id: userId } });
    if (existingCourse) {
      // Heal onboarding_complete: an account with subjects whose flag was never
      // set would otherwise be re-routed into onboarding on every launch (this
      // branch always short-circuits). Consent/age were validated above.
      await this.prisma.profile.update({
        where: { id: userId },
        data: {
          onboarding_complete: true,
          consent_given: true,
          consent_timestamp: new Date(),
          consent_version: dto.consent_version ?? null,
          age: dto.age,
          ...(dto.name !== undefined ? { full_name: dto.name, display_name: dto.name } : {}),
        },
      });
      return { ...(await this.summary(userId)), status: 'already_completed' };
    }

    const sem = dto.semester ?? { name: 'My Semester', start: this.todayYmd(), end: this.plusMonthsYmd(6) };

    await this.prisma.$transaction(async (tx) => {
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

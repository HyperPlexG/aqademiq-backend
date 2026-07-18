import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { StreaksService } from '../streaks/streaks.service';
import { UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  private readonly log = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly streaks: StreaksService,
  ) {}

  /**
   * DELETE /profile/account — full account deletion (store-policy requirement).
   *
   * Order matters: the Supabase Auth identity is deleted FIRST (admin API,
   * service-role key) so the account can no longer sign in even if the data
   * purge below were to fail partway; a retry then just re-purges data.
   * Feedback-board rows keyed to auth.users are handled by the DB's own
   * ON DELETE CASCADE / SET NULL on Supabase.
   *
   * The caller's access token stays cryptographically valid until it expires
   * (verification is signature-only) — the client must sign out locally after
   * a successful response.
   */
  async deleteAccount() {
    const userId = this.rc.userId;

    const base = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (base && serviceKey) {
      const res = await fetch(`${base}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      });
      // 404 = already deleted (e.g. a retry after a partial failure) — proceed.
      if (!res.ok && res.status !== 404) {
        this.log.error(`Supabase admin user delete failed (${res.status}): ${await res.text()}`);
        throw new BadGatewayException('Could not delete the account identity — try again');
      }
    } else if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Account deletion is not configured (SUPABASE_SERVICE_ROLE_KEY)');
    } else {
      this.log.warn('SUPABASE_SERVICE_ROLE_KEY not set — skipping auth-identity deletion (dev only)');
    }

    // Purge all public-schema data. Children before parents where tenant
    // tables reference each other; TaskStep/AdaMessage/ReferralRedemption/
    // TaskRescheduleHistory cascade from their parents.
    const where = { where: { user_id: userId } };
    await this.prisma.$transaction([
      this.prisma.taskTag.deleteMany(where),
      this.prisma.calendarEvent.deleteMany(where),
      this.prisma.task.deleteMany(where),
      this.prisma.subjectMaterial.deleteMany(where),
      this.prisma.course.deleteMany(where),
      this.prisma.academicTerm.deleteMany(where),
      this.prisma.studyTag.deleteMany(where),
      this.prisma.calendarConnection.deleteMany(where),
      this.prisma.prismAudioProfile.deleteMany(where),
      this.prisma.focusSession.deleteMany(where),
      this.prisma.moodCheckin.deleteMany(where),
      this.prisma.analyticsSnapshot.deleteMany(where),
      this.prisma.dailyActivitySnapshot.deleteMany(where),
      this.prisma.adaSession.deleteMany(where),
      this.prisma.referralCode.deleteMany(where),
      this.prisma.shareEvent.deleteMany(where),
      this.prisma.appRating.deleteMany(where),
      this.prisma.appFeedback.deleteMany(where),
      this.prisma.deviceProfile.deleteMany(where),
      this.prisma.notificationPreferences.deleteMany(where),
      this.prisma.userAppSettings.deleteMany(where),
      this.prisma.userProfile.deleteMany(where),
      this.prisma.profile.deleteMany({ where: { id: userId } }),
    ]);

    return { status: 'deleted' };
  }

  /** GET /me/stats */
  async stats() {
    const db = this.prisma.tenant;
    const [streak, completedTasks, focus, subjectsCount] = await Promise.all([
      this.streaks.current(),
      db.task.count({ where: { status: 'completed' } }),
      db.focusSession.findMany({ where: { status: 'completed' }, select: { actual_duration_mins: true } }),
      db.course.count(),
    ]);
    const focusMinutes = focus.reduce((sum, f) => sum + (f.actual_duration_mins ?? 0), 0);
    return {
      current_streak: streak.current_streak,
      total_active_days: streak.total_active_days,
      completed_tasks: completedTasks,
      focus_minutes: focusMinutes,
      focus_sessions: focus.length,
      subjects_count: subjectsCount,
    };
  }

  async get() {
    const [user, profile] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { id: this.rc.userId },
        select: { email: true, is_guest: true, full_name: true, display_name: true, gender: true, date_of_birth: true, avatar_url: true },
      }),
      this.prisma.userProfile.findUnique({ where: { user_id: this.rc.userId } }),
    ]);
    return this.dto(user, profile);
  }

  async update(dto: UpdateProfileDto) {
    const userData: Record<string, any> = {};
    if (dto.name !== undefined) {
      userData.full_name = dto.name;
      userData.display_name = dto.name;
    }
    if (dto.gender !== undefined) userData.gender = dto.gender;
    if (dto.date_of_birth !== undefined) {
      userData.date_of_birth = dto.date_of_birth ? new Date(`${dto.date_of_birth}T00:00:00.000Z`) : null;
    }
    if (dto.avatar_index !== undefined) {
      userData.avatar_url = String(dto.avatar_index);
    }

    if (Object.keys(userData).length > 0) {
      await this.prisma.profile.update({
        where: { id: this.rc.userId },
        data: userData,
      });
    }

    const profileData: Record<string, any> = {};
    if (dto.university !== undefined) profileData.university = dto.university;
    if (dto.program !== undefined) profileData.program = dto.program;

    let profile = null;
    if (Object.keys(profileData).length > 0) {
      profile = await this.prisma.userProfile.upsert({
        where: { user_id: this.rc.userId },
        create: { user_id: this.rc.userId, ...profileData },
        update: profileData,
      });
    } else {
      profile = await this.prisma.userProfile.findUnique({ where: { user_id: this.rc.userId } });
    }

    const user = await this.prisma.profile.findUnique({
      where: { id: this.rc.userId },
      select: { email: true, is_guest: true, full_name: true, display_name: true, gender: true, date_of_birth: true, avatar_url: true },
    });
    return this.dto(user, profile);
  }

  private dto(user: any, profile: any) {
    return {
      name: user?.full_name ?? user?.display_name ?? null,
      email: user?.email ?? null,
      is_guest: user?.is_guest ?? true,
      gender: user?.gender ?? null,
      date_of_birth: user?.date_of_birth ? new Date(user.date_of_birth).toISOString().slice(0, 10) : null,
      university: profile?.university ?? null,
      program: profile?.program ?? null,
      avatar_index: user?.avatar_url ? parseInt(user.avatar_url, 10) || 0 : 0,
    };
  }
}

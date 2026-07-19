// §2.8 — profile + account deletion + stats. Port of src/features/profile/profile.service.ts.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { env } from '../../_shared/env.ts';
import { streaksService } from './streaks.service.ts';

export interface UpdateProfileDto {
  name?: string;
  gender?: string;
  date_of_birth?: string;
  university?: string;
  program?: string;
  avatar_index?: number;
}

// deno-lint-ignore no-explicit-any
function toDto(user: any, profile: any) {
  return {
    name: user?.full_name ?? user?.display_name ?? null,
    email: user?.email ?? null,
    is_guest: user?.is_guest ?? true,
    gender: user?.gender ?? null,
    date_of_birth: user?.date_of_birth ? new Date(user.date_of_birth).toISOString().slice(0, 10) : null,
    university: profile?.university ?? null,
    program: profile?.program ?? null,
    avatar_index: user?.avatar_url ? parseInt(user.avatar_url, 10) || 0 : 0,
    onboarding_complete: user?.onboarding_complete ?? false,
  };
}

const USER_SELECT = {
  email: true, is_guest: true, full_name: true, display_name: true,
  gender: true, date_of_birth: true, avatar_url: true, onboarding_complete: true,
} as const;

export const profileService = {
  async get() {
    const [user, profile] = await Promise.all([
      prismaBase().profile.findUnique({ where: { id: RequestContext.userId }, select: USER_SELECT }),
      prismaBase().userProfile.findUnique({ where: { user_id: RequestContext.userId } }),
    ]);
    return toDto(user, profile);
  },

  async update(dto: UpdateProfileDto) {
    const userId = RequestContext.userId;
    // deno-lint-ignore no-explicit-any
    const userData: Record<string, any> = {};
    if (dto.name !== undefined) { userData.full_name = dto.name; userData.display_name = dto.name; }
    if (dto.gender !== undefined) userData.gender = dto.gender;
    if (dto.date_of_birth !== undefined) {
      userData.date_of_birth = dto.date_of_birth ? new Date(`${dto.date_of_birth}T00:00:00.000Z`) : null;
    }
    if (dto.avatar_index !== undefined) userData.avatar_url = String(dto.avatar_index);

    if (Object.keys(userData).length > 0) {
      await prismaBase().profile.update({ where: { id: userId }, data: userData });
    }

    // deno-lint-ignore no-explicit-any
    const profileData: Record<string, any> = {};
    if (dto.university !== undefined) profileData.university = dto.university;
    if (dto.program !== undefined) profileData.program = dto.program;

    // deno-lint-ignore no-explicit-any
    let profile: any = null;
    if (Object.keys(profileData).length > 0) {
      profile = await prismaBase().userProfile.upsert({
        where: { user_id: userId },
        create: { user_id: userId, ...profileData },
        update: profileData,
      });
    } else {
      profile = await prismaBase().userProfile.findUnique({ where: { user_id: userId } });
    }

    const user = await prismaBase().profile.findUnique({ where: { id: userId }, select: USER_SELECT });
    return toDto(user, profile);
  },

  /**
   * DELETE /profile/account — full account deletion (store-policy requirement).
   * Deletes the Supabase Auth identity first (admin API), then purges data.
   */
  async deleteAccount() {
    const userId = RequestContext.userId;

    const base = (env('SUPABASE_URL') ?? '').replace(/\/+$/, '');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (base && serviceKey) {
      const res = await fetch(`${base}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      });
      if (!res.ok && res.status !== 404) {
        console.error(`Supabase admin user delete failed (${res.status}): ${await res.text()}`);
        throw new HttpError(502, 'Could not delete the account identity — try again');
      }
    } else if (env('NODE_ENV') === 'production') {
      throw new HttpError(503, 'Account deletion is not configured (SUPABASE_SERVICE_ROLE_KEY)');
    } else {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set — skipping auth-identity deletion (dev only)');
    }

    const db = prismaBase();
    const where = { where: { user_id: userId } };
    await db.$transaction([
      db.taskTag.deleteMany(where),
      db.calendarEvent.deleteMany(where),
      db.task.deleteMany(where),
      db.subjectMaterial.deleteMany(where),
      db.course.deleteMany(where),
      db.academicTerm.deleteMany(where),
      db.studyTag.deleteMany(where),
      db.calendarConnection.deleteMany(where),
      db.prismAudioProfile.deleteMany(where),
      db.focusSession.deleteMany(where),
      db.moodCheckin.deleteMany(where),
      db.analyticsSnapshot.deleteMany(where),
      db.dailyActivitySnapshot.deleteMany(where),
      db.adaSession.deleteMany(where),
      db.referralCode.deleteMany(where),
      db.shareEvent.deleteMany(where),
      db.appRating.deleteMany(where),
      db.appFeedback.deleteMany(where),
      db.deviceProfile.deleteMany(where),
      db.notificationPreferences.deleteMany(where),
      db.userAppSettings.deleteMany(where),
      db.userProfile.deleteMany(where),
      db.profile.deleteMany({ where: { id: userId } }),
    ]);

    return { status: 'deleted' };
  },

  /** GET /me/stats */
  async stats() {
    const db = tenantDb();
    const [streak, completedTasks, focus, subjectsCount] = await Promise.all([
      streaksService.current(),
      db.task.count({ where: { status: 'completed' } }),
      db.focusSession.findMany({ where: { status: 'completed' }, select: { actual_duration_mins: true } }),
      db.course.count(),
    ]);
    const focusMinutes = focus.reduce((sum: number, f: { actual_duration_mins: number | null }) => sum + (f.actual_duration_mins ?? 0), 0);
    return {
      current_streak: streak.current_streak,
      total_active_days: streak.total_active_days,
      completed_tasks: completedTasks,
      focus_minutes: focusMinutes,
      focus_sessions: focus.length,
      subjects_count: subjectsCount,
    };
  },
};

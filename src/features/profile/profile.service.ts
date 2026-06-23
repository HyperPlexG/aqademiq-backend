import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { StreaksService } from '../streaks/streaks.service';
import { UpdateProfileDto } from './dto/profile.dto';

/** §2.8 — UserProfile (1:1 with User). Created on demand. `email`/`is_guest`
 *  come from the User row; the rest from UserProfile. */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly streaks: StreaksService,
  ) {}

  /** GET /me/stats — single aggregated StatsDto for the Profile/Stats screen
   *  (§06): streak + lifetime task completions + focus minutes + subjects. */
  async stats() {
    const db = this.prisma.tenant;
    const [streak, completedTasks, focus, subjectsCount] = await Promise.all([
      this.streaks.current(),
      db.activityEvent.count({ where: { source: 'task_completion' } }),
      db.focusSession.findMany({ where: { status: 'COMPLETE' }, select: { elapsed_sec: true } }),
      db.subject.count({ where: { deleted_at: null } }),
    ]);
    const focusSeconds = focus.reduce((sum, f) => sum + (f.elapsed_sec ?? 0), 0);
    return {
      current_streak: streak.current_streak,
      total_active_days: streak.total_active_days,
      completed_tasks: completedTasks,
      focus_minutes: Math.round(focusSeconds / 60),
      focus_sessions: focus.length,
      subjects_count: subjectsCount,
    };
  }

  async get() {
    const [user, profile] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: this.rc.userId }, select: { email: true, is_guest: true } }),
      this.prisma.userProfile.findUnique({ where: { user_id: this.rc.userId } }),
    ]);
    return this.dto(user, profile);
  }

  async update(dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.date_of_birth !== undefined) data.date_of_birth = new Date(`${dto.date_of_birth}T00:00:00.000Z`);
    if (dto.university !== undefined) data.university = dto.university;
    if (dto.program !== undefined) data.program = dto.program;
    if (dto.avatar_index !== undefined) data.avatar_index = dto.avatar_index;

    const profile = await this.prisma.userProfile.upsert({
      where: { user_id: this.rc.userId },
      create: { user_id: this.rc.userId, ...data },
      update: data,
    });
    const user = await this.prisma.user.findUnique({
      where: { id: this.rc.userId },
      select: { email: true, is_guest: true },
    });
    return this.dto(user, profile);
  }

  private dto(
    user: { email: string | null; is_guest: boolean } | null,
    profile: { name: string | null; gender: string | null; date_of_birth: Date | null; university: string | null; program: string | null; avatar_index: number } | null,
  ) {
    return {
      name: profile?.name ?? null,
      email: user?.email ?? null,
      is_guest: user?.is_guest ?? true,
      gender: profile?.gender ?? null,
      date_of_birth: profile?.date_of_birth ? profile.date_of_birth.toISOString().slice(0, 10) : null,
      university: profile?.university ?? null,
      program: profile?.program ?? null,
      avatar_index: profile?.avatar_index ?? 0,
    };
  }
}

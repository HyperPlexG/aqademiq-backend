import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { StreaksService } from '../streaks/streaks.service';
import { UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly streaks: StreaksService,
  ) {}

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

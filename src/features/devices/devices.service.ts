import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { RegisterDeviceDto, UpdateDeviceDto } from './dto/devices.dto';

/** §2.9/§4.5 — device & push-token registry. IANA timezone is validated and
 *  stored server-side so reminders fire on local wall-clock (never UTC). */
@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  /** POST /devices — register or re-register (idempotent on push_token). */
  async register(dto: RegisterDeviceDto) {
    this.assertValidTimezone(dto.timezone);
    
    // Update user's timezone
    await this.prisma.profile.update({
      where: { id: this.rc.userId },
      data: { timezone: dto.timezone },
    });

    const existing = await this.prisma.tenant.deviceProfile.findFirst({ where: { push_token: dto.push_token } });
    if (existing) {
      const updated = await this.prisma.deviceProfile.update({
        where: { id: existing.id },
        data: {
          device_type: dto.platform,
        },
      });
      return this.dto(updated, dto.timezone);
    }
    const created = await this.prisma.deviceProfile.create({
      data: {
        user_id: this.rc.userId,
        push_token: dto.push_token,
        device_type: dto.platform,
      },
    });
    return this.dto(created, dto.timezone);
  }

  async update(id: string, dto: UpdateDeviceDto) {
    const existing = await this.owned(id);
    let timezone: string = dto.timezone ?? 'UTC';
    if (dto.timezone) {
      this.assertValidTimezone(dto.timezone);
      await this.prisma.profile.update({
        where: { id: this.rc.userId },
        data: { timezone: dto.timezone },
      });
    } else {
      const u = await this.prisma.profile.findUnique({ where: { id: this.rc.userId } });
      timezone = u?.timezone ?? 'UTC';
    }
    const updated = await this.prisma.deviceProfile.update({
      where: { id },
      data: {
        ...(dto.push_token !== undefined ? { push_token: dto.push_token } : {}),
      },
    });
    return this.dto(updated, timezone);
  }

  /** DELETE /devices/:id — revoke (soft) so delivery stops. */
  async remove(id: string) {
    await this.owned(id);
    await this.prisma.deviceProfile.delete({ where: { id } });
    return { status: 'revoked', id };
  }

  /** POST /devices/:id/heartbeat — confirm alive; optional tz refresh on travel. */
  async heartbeat(id: string, dto: UpdateDeviceDto) {
    await this.owned(id);
    if (dto.timezone) {
      this.assertValidTimezone(dto.timezone);
      await this.prisma.profile.update({
        where: { id: this.rc.userId },
        data: { timezone: dto.timezone },
      });
    }
    return { status: 'ok', id };
  }

  // ---- internals ---------------------------------------------------------

  private async owned(id: string) {
    const d = await this.prisma.tenant.deviceProfile.findFirst({ where: { id } });
    if (!d) throw new NotFoundException('Device not found');
    return d;
  }

  private assertValidTimezone(tz: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      throw new UnprocessableEntityException(`Invalid IANA timezone: ${tz}`);
    }
  }

  private dto(d: any, timezone: string) {
    return {
      id: d.id,
      push_token: d.push_token,
      platform: d.device_type ?? 'ios',
      token_provider: d.device_type === 'ios' ? 'apns' : 'fcm',
      timezone: timezone,
      permission: 'granted',
      revoked: false,
    };
  }
}

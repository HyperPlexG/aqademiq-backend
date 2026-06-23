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
    const existing = await this.prisma.tenant.device.findFirst({ where: { push_token: dto.push_token } });
    if (existing) {
      const updated = await this.prisma.device.update({
        where: { id: existing.id },
        data: {
          platform: dto.platform,
          token_provider: dto.token_provider,
          timezone: dto.timezone,
          permission: dto.permission ?? existing.permission,
          revoked_at: null,
        },
      });
      return this.dto(updated);
    }
    const created = await this.prisma.device.create({
      data: {
        user_id: this.rc.userId,
        push_token: dto.push_token,
        platform: dto.platform,
        token_provider: dto.token_provider,
        timezone: dto.timezone,
        permission: dto.permission ?? 'granted',
      },
    });
    return this.dto(created);
  }

  async update(id: string, dto: UpdateDeviceDto) {
    await this.owned(id);
    if (dto.timezone) this.assertValidTimezone(dto.timezone);
    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        ...(dto.push_token !== undefined ? { push_token: dto.push_token } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.permission !== undefined ? { permission: dto.permission } : {}),
      },
    });
    return this.dto(updated);
  }

  /** DELETE /devices/:id — revoke (soft) so delivery stops. */
  async remove(id: string) {
    await this.owned(id);
    await this.prisma.device.update({ where: { id }, data: { revoked_at: new Date() } });
    return { status: 'revoked', id };
  }

  /** POST /devices/:id/heartbeat — confirm alive; optional tz refresh on travel. */
  async heartbeat(id: string, dto: UpdateDeviceDto) {
    await this.owned(id);
    if (dto.timezone) this.assertValidTimezone(dto.timezone);
    await this.prisma.device.update({
      where: { id },
      data: { revoked_at: null, ...(dto.timezone ? { timezone: dto.timezone } : {}) },
    });
    return { status: 'ok', id };
  }

  // ---- internals ---------------------------------------------------------

  private async owned(id: string) {
    const d = await this.prisma.tenant.device.findFirst({ where: { id } });
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

  private dto(d: any) {
    return {
      id: d.id,
      push_token: d.push_token,
      platform: d.platform,
      token_provider: d.token_provider,
      timezone: d.timezone,
      permission: d.permission,
      revoked: d.revoked_at != null,
    };
  }
}

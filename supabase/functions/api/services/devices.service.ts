// §2.9/§4.5 — device & push-token registry. Port of src/features/devices/devices.service.ts.
// IANA timezone is validated and stored server-side (on Profile) so reminders fire
// on local wall-clock (never UTC).
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';

export interface RegisterDeviceDto {
  push_token: string;
  platform: string;
  token_provider: string;
  timezone: string;
  permission?: string;
}

export interface UpdateDeviceDto {
  push_token?: string;
  timezone?: string;
  permission?: string;
}

function assertValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw new HttpError(422, `Invalid IANA timezone: ${tz}`);
  }
}

// deno-lint-ignore no-explicit-any
function toDto(d: any, timezone: string) {
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

/** Ownership assertion — throws 404 if not the caller's device. */
async function owned(id: string) {
  const d = await tenantDb().deviceProfile.findFirst({ where: { id } });
  if (!d) throw new HttpError(404, 'Device not found');
  return d;
}

export const devicesService = {
  /** POST /devices — register or re-register (idempotent on push_token). */
  async register(dto: RegisterDeviceDto) {
    assertValidTimezone(dto.timezone);

    // Update user's timezone
    await prismaBase().profile.update({
      where: { id: RequestContext.userId },
      data: { timezone: dto.timezone },
    });

    const existing = await tenantDb().deviceProfile.findFirst({ where: { push_token: dto.push_token } });
    if (existing) {
      const updated = await prismaBase().deviceProfile.update({
        where: { id: existing.id },
        data: {
          device_type: dto.platform,
        },
      });
      return toDto(updated, dto.timezone);
    }
    const created = await prismaBase().deviceProfile.create({
      data: {
        user_id: RequestContext.userId,
        push_token: dto.push_token,
        device_type: dto.platform,
      },
    });
    return toDto(created, dto.timezone);
  },

  async update(id: string, dto: UpdateDeviceDto) {
    await owned(id); // ownership assertion — throws if not the caller's device
    let timezone: string = dto.timezone ?? 'UTC';
    if (dto.timezone) {
      assertValidTimezone(dto.timezone);
      await prismaBase().profile.update({
        where: { id: RequestContext.userId },
        data: { timezone: dto.timezone },
      });
    } else {
      const u = await prismaBase().profile.findUnique({ where: { id: RequestContext.userId } });
      timezone = u?.timezone ?? 'UTC';
    }
    const updated = await prismaBase().deviceProfile.update({
      where: { id },
      data: {
        ...(dto.push_token !== undefined ? { push_token: dto.push_token } : {}),
      },
    });
    return toDto(updated, timezone);
  },

  /** DELETE /devices/:id — revoke (soft) so delivery stops. */
  async remove(id: string) {
    await owned(id);
    await prismaBase().deviceProfile.delete({ where: { id } });
    return { status: 'revoked', id };
  },

  /** POST /devices/:id/heartbeat — confirm alive; optional tz refresh on travel. */
  async heartbeat(id: string, dto: UpdateDeviceDto) {
    await owned(id);
    if (dto.timezone) {
      assertValidTimezone(dto.timezone);
      await prismaBase().profile.update({
        where: { id: RequestContext.userId },
        data: { timezone: dto.timezone },
      });
    }
    return { status: 'ok', id };
  },
};

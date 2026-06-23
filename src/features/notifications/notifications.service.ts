import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { PushService } from '../../infra/push.service';
import { RequestContext } from '../../common/request-context';

/** §2.9 — notification read paths over NotificationLog (scoped via the user's
 *  devices, since NotificationLog isn't a tenant model). Actual push delivery
 *  (APNs/FCM) is a separate worker and requires provider credentials. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly rc: RequestContext,
  ) {}

  /** GET /me/notifications/history — delivery log, newest first. */
  async history() {
    const logs = await this.userLogs();
    return { notifications: logs.map((l) => this.dto(l)) };
  }

  /** GET /me/notifications/inbox — in-app notification center (unread-aware). */
  async inbox() {
    const logs = await this.userLogs();
    return {
      notifications: logs.map((l) => this.dto(l)),
      unread_count: logs.filter((l) => l.read_at == null).length,
    };
  }

  /**
   * POST /me/notifications/test — records a queued log row. Delivery to APNs/FCM
   * happens in the push worker; without provider credentials it is marked
   * `skipped_no_provider` so the flow is exercisable end-to-end locally.
   */
  async test() {
    const device = await this.prisma.tenant.device.findFirst({
      where: { revoked_at: null },
      orderBy: { id: 'desc' },
    });
    if (!device) throw new BadRequestException('No registered device to send a test push to');

    const result = await this.push.send(
      device.token_provider,
      device.push_token,
      'Aqademiq',
      'This is a test notification 🎓',
      { channel_key: 'test' },
    );
    const log = await this.prisma.notificationLog.create({
      data: {
        device_id: device.id,
        idempotency_key: `test:${this.rc.userId}:${Date.now()}`,
        channel_key: 'test',
        status: result.status,
      },
    });
    return { ...this.dto(log), provider: device.token_provider, error: result.error };
  }

  // ---- internals ---------------------------------------------------------

  private async userLogs() {
    const devices = await this.prisma.tenant.device.findMany({ select: { id: true } });
    const ids = devices.map((d) => d.id);
    if (ids.length === 0) return [];
    return this.prisma.notificationLog.findMany({
      where: { device_id: { in: ids } },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  private dto(l: { id: string; channel_key: string; status: string; read_at: Date | null; created_at: Date }) {
    return {
      id: l.id,
      channel_key: l.channel_key,
      status: l.status,
      read: l.read_at != null,
      created_at: l.created_at,
    };
  }
}

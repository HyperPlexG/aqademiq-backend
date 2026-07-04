import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service';
import { PushService } from '../../infra/push.service';
import { RequestContext } from '../../common/request-context';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly rc: RequestContext,
  ) {}

  /** GET /me/notifications/history */
  async history() {
    return { notifications: [] };
  }

  /** GET /me/notifications/inbox */
  async inbox() {
    return {
      notifications: [],
      unread_count: 0,
    };
  }

  /** POST /me/notifications/test */
  async test() {
    const device = await this.prisma.tenant.deviceProfile.findFirst({
      orderBy: { id: 'desc' },
    });
    if (!device) throw new BadRequestException('No registered device to send a test push to');

    const provider = device.device_type === 'ios' ? 'apns' : 'fcm';
    const token = device.push_token ?? '';
    const result = await this.push.send(
      provider,
      token,
      'Aqademiq',
      'This is a test notification 🎓',
      { channel_key: 'test' },
    );
    
    return {
      id: crypto.randomUUID(),
      channel_key: 'test',
      status: result.status,
      read: false,
      created_at: new Date(),
      provider,
      error: result.error
    };
  }
}

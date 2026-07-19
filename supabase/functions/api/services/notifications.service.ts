// §2.9 — notifications inbox/history + test push. Port of
// src/features/notifications/notifications.service.ts.
import { tenantDb } from '../../_shared/prisma.ts';
import { HttpError } from '../../_shared/http.ts';
import { push } from '../../_shared/push.ts';

export const notificationsService = {
  /** GET /me/notifications/history */
  async history() {
    return { notifications: [] };
  },

  /** GET /me/notifications/inbox */
  async inbox() {
    return {
      notifications: [],
      unread_count: 0,
    };
  },

  /** POST /me/notifications/test */
  async test() {
    const device = await tenantDb().deviceProfile.findFirst({
      orderBy: { id: 'desc' },
    });
    if (!device) throw new HttpError(400, 'No registered device to send a test push to');

    const provider = device.device_type === 'ios' ? 'apns' : 'fcm';
    const token = device.push_token ?? '';
    const result = await push.send(
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
      error: result.error,
    };
  },
};

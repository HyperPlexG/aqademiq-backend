import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import * as fs from 'node:fs';
import { PrismaService } from '../../infra/prisma.service';
import { PushService } from '../../infra/push.service';
import { RedisService } from '../../infra/redis.service';

@Injectable()
export class ReminderWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    const connection: any = {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: null,
    };
    if (process.env.REDIS_AUTH_STRING) connection.password = process.env.REDIS_AUTH_STRING;
    if (process.env.REDIS_CA_CERT_PATH) connection.tls = { ca: [fs.readFileSync(process.env.REDIS_CA_CERT_PATH, 'utf8')] };

    this.worker = new Worker(
      'reminders',
      async (job) => {
        const { deviceId, channelKey, idempotencyKey, title, body } = job.data;

        // Dedup guarantee via Redis SET NX
        const setOk = await this.redis.client.set(idempotencyKey, 'queued', 'PX', 86400 * 1000, 'NX');
        if (!setOk) {
          return { deduped: true };
        }

        const device = await this.prisma.deviceProfile.findUnique({ where: { id: deviceId } });
        if (!device) {
          return { skipped: true };
        }

        const provider = device.device_type === 'ios' ? 'apns' : 'fcm';
        const token = device.push_token ?? '';
        const result = await this.push.send(provider, token, title, body, { channel_key: channelKey });
        return result;
      },
      { connection },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}

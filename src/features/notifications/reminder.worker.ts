import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import * as fs from 'node:fs';
import { PrismaService } from '../../infra/prisma.service';
import { PushService } from '../../infra/push.service';

/**
 * §4.5 — reminder delivery worker. Consumes the BullMQ `reminders` queue,
 * dedups on the NotificationLog UNIQUE idempotency_key (the only thing stopping
 * the cron sweep + multi-worker queue from double-sending), then delivers via
 * PushService and records the outcome.
 *
 * Runs in-process here for single-instance/dev; in prod this is a separate
 * Cloud Run worker (same code, started the same way). Inert until REMINDERS_CRON
 * is enabled or a sweep is triggered — the queue is simply empty otherwise.
 */
@Injectable()
export class ReminderWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
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

        // Dedup guarantee: the UNIQUE idempotency_key makes a duplicate a no-op.
        try {
          await this.prisma.notificationLog.create({
            data: { device_id: deviceId, idempotency_key: idempotencyKey, channel_key: channelKey, status: 'queued' },
          });
        } catch (e: any) {
          if (e?.code === 'P2002') return { deduped: true };
          throw e;
        }

        const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
        if (!device || device.revoked_at) {
          await this.prisma.notificationLog.update({ where: { idempotency_key: idempotencyKey }, data: { status: 'skipped_revoked' } });
          return { skipped: true };
        }

        const result = await this.push.send(device.token_provider, device.push_token, title, body, { channel_key: channelKey });
        await this.prisma.notificationLog.update({ where: { idempotency_key: idempotencyKey }, data: { status: result.status } });
        return result;
      },
      { connection },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}

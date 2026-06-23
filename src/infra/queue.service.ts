import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import * as fs from 'node:fs';

/** §4.5 / §7: BullMQ on Redis (kept per spec rather than Cloud Tasks).
 *  Queues: reminders (delayed, per-tz wall-clock), ai-jobs (plan-week/extraction),
 *  email (OTP/digests). Workers run as separate Cloud Run jobs/services.
 *  BullMQ manages its own ioredis connection from these options. */
@Injectable()
export class QueueService {
  readonly reminders: Queue;
  readonly aiJobs: Queue;
  readonly email: Queue;

  constructor() {
    const connection: any = {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: null,
    };
    if (process.env.REDIS_AUTH_STRING) connection.password = process.env.REDIS_AUTH_STRING;
    if (process.env.REDIS_CA_CERT_PATH)
      connection.tls = { ca: [fs.readFileSync(process.env.REDIS_CA_CERT_PATH, 'utf8')] };

    this.reminders = new Queue('reminders', { connection });
    this.aiJobs = new Queue('ai-jobs', { connection });
    this.email = new Queue('email', { connection });
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import * as fs from 'node:fs';

/** Memorystore-ready Redis (§7): cache, rate-limit, deny-list, BullMQ, pub/sub.
 *  Handles AUTH + TLS + reconnect for Cloud Run's ephemeral instances. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  constructor() {
    const opts: any = {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: null, // required by BullMQ
      retryStrategy: (n: number) => Math.min(n * 200, 2000),
    };
    if (process.env.REDIS_AUTH_STRING) opts.password = process.env.REDIS_AUTH_STRING;
    if (process.env.REDIS_CA_CERT_PATH) opts.tls = { ca: [fs.readFileSync(process.env.REDIS_CA_CERT_PATH, 'utf8')] };
    this.client = new Redis(opts);
  }
  onModuleDestroy() { this.client.disconnect(); }
}

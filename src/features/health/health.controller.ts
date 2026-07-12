import { randomUUID } from 'node:crypto';
import { Controller, Get, Header, HttpException, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';

/** §5 ops endpoints — liveness, readiness (DB+Redis), basic metrics. */
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness — process is up. */
  @Public()
  @Get('healthz')
  healthz() {
    return { status: 'ok' };
  }

  /** Readiness — dependencies reachable. 503 if DB or Redis is down (Cloud Run
   *  gates traffic on this). */
  @Public()
  @Get('readyz')
  async readyz() {
    const [db, redis] = await Promise.all([this.pingDb(), this.pingRedis()]);
    const ready = db && redis;
    if (!ready) {
      throw new HttpException(
        { status: 'not_ready', db: db ? 'ok' : 'down', redis: redis ? 'ok' : 'down' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ready', db: 'ok', redis: 'ok' };
  }

  /** Minimal Prometheus-format metrics (§4.8). Expand with OTel later. */
  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  metrics() {
    const mem = process.memoryUsage();
    return [
      '# HELP process_uptime_seconds Process uptime.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime().toFixed(0)}`,
      '# HELP process_resident_memory_bytes Resident memory.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${mem.rss}`,
      '# HELP nodejs_heap_used_bytes Heap used.',
      '# TYPE nodejs_heap_used_bytes gauge',
      `nodejs_heap_used_bytes ${mem.heapUsed}`,
      '',
    ].join('\n');
  }

  /** Debug-only Cloud SQL smoke test. Creates a table and inserts 5 rows. */
  @Public()
  @Post('debug/sql-smoke-test')
  async sqlSmokeTest() {
    if (process.env.ENABLE_SQL_SMOKE_TEST !== '1') {
      throw new HttpException(
        { message: 'SQL smoke test endpoint is disabled. Set ENABLE_SQL_SMOKE_TEST=1 locally to use it.' },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS gcp_connection_smoke_test (
        id UUID PRIMARY KEY,
        sample_label TEXT NOT NULL,
        sample_value INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const batchId = randomUUID();
    for (let index = 1; index <= 5; index += 1) {
      await this.prisma.$executeRaw`
        INSERT INTO gcp_connection_smoke_test (id, sample_label, sample_value)
        VALUES (${randomUUID()}::uuid, ${`sample_row_${index}_batch_${batchId}`}, ${index})
      `;
    }

    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      sample_label: string;
      sample_value: number;
      created_at: Date;
    }>>`
      SELECT id, sample_label, sample_value, created_at
      FROM gcp_connection_smoke_test
      ORDER BY created_at DESC
      LIMIT 5
    `;

    return {
      status: 'ok',
      table: 'gcp_connection_smoke_test',
      inserted_rows: 5,
      batch_id: batchId,
      latest_rows: rows,
    };
  }

  private async pingDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      return (await this.redis.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}

import { Controller, Get, Header, HttpException, HttpStatus } from '@nestjs/common';
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

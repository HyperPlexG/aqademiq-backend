import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { StorageService } from './storage.service';
import { ClaudeService } from './claude.service';
import { QueueService } from './queue.service';
import { TokenService } from './token.service';
import { RevisionService } from './revision.service';
import { PushService } from './push.service';
import { RequestContext } from '../common/request-context';

/** Shared infrastructure available to every feature module. */
@Global()
@Module({
  providers: [RequestContext, PrismaService, RedisService, StorageService, ClaudeService, QueueService, TokenService, RevisionService, PushService],
  exports: [RequestContext, PrismaService, RedisService, StorageService, ClaudeService, QueueService, TokenService, RevisionService, PushService],
})
export class InfraModule {}

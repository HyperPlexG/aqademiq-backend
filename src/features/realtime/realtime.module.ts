import { Module } from '@nestjs/common';
import { RevisionsGateway } from './revisions.gateway';
@Module({ providers: [RevisionsGateway] })
export class RealtimeModule {}

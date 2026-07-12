import { Module } from '@nestjs/common';
import { StreaksController } from './streaks.controller';
import { ActivityController } from './activity.controller';
import { StreaksService } from './streaks.service';

@Module({ controllers: [StreaksController, ActivityController], providers: [StreaksService], exports: [StreaksService] })
export class StreaksModule {}

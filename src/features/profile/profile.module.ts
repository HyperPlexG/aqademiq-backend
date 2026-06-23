import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { StatsController } from './stats.controller';
import { ProfileService } from './profile.service';
import { StreaksModule } from '../streaks/streaks.module';

@Module({
  imports: [StreaksModule],
  controllers: [ProfileController, StatsController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}

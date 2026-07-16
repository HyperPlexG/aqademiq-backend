import { Module } from '@nestjs/common';
import { FocusController } from './focus.controller';
import { FocusService } from './focus.service';
import { TasksModule } from '../tasks/tasks.module';
import { PrismModule } from '../prism/prism.module';

@Module({
  imports: [TasksModule, PrismModule],
  controllers: [FocusController],
  providers: [FocusService],
  exports: [FocusService],
})
export class FocusModule {}

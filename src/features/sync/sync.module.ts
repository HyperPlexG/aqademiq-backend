import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { TasksModule } from '../tasks/tasks.module';
import { SubjectsModule } from '../subjects/subjects.module';

@Module({
  imports: [TasksModule, SubjectsModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}

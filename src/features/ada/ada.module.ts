import { Module } from '@nestjs/common';
import { AdaController } from './ada.controller';
import { AdaService } from './ada.service';
import { TasksModule } from '../tasks/tasks.module';
import { SubjectsModule } from '../subjects/subjects.module';

@Module({
  imports: [TasksModule, SubjectsModule],
  controllers: [AdaController],
  providers: [AdaService],
  exports: [AdaService],
})
export class AdaModule {}

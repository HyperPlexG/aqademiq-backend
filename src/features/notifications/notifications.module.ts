import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';
import { ReminderWorker } from './reminder.worker';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, RemindersService, ReminderWorker],
  exports: [NotificationsService, RemindersService],
})
export class NotificationsModule {}

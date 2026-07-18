import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { InfraModule } from "./infra/infra.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { ContextInterceptor } from "./common/interceptors/context.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { IdempotencyMiddleware } from "./common/middleware/idempotency.middleware";
import { RateLimitMiddleware } from "./common/middleware/rate-limit.middleware";

import { AdaModule } from "./features/ada/ada.module";
import { DevicesModule } from "./features/devices/devices.module";
import { FeedbackModule } from "./features/feedback/feedback.module";
import { FilesModule } from "./features/files/files.module";
import { FocusModule } from "./features/focus/focus.module";
import { HealthModule } from "./features/health/health.module";
import { IntegrationsModule } from "./features/integrations/integrations.module";
import { MoodModule } from "./features/mood/mood.module";
import { NotificationsModule } from "./features/notifications/notifications.module";
import { OnboardingModule } from "./features/onboarding/onboarding.module";
import { PrismModule } from "./features/prism/prism.module";
import { ProfileModule } from "./features/profile/profile.module";
import { RealtimeModule } from "./features/realtime/realtime.module";
import { ReferralsModule } from "./features/referrals/referrals.module";
import { SemestersModule } from "./features/semesters/semesters.module";
import { SettingsModule } from "./features/settings/settings.module";
import { StreaksModule } from "./features/streaks/streaks.module";
import { SubjectsModule } from "./features/subjects/subjects.module";
import { SyncModule } from "./features/sync/sync.module";
import { TagsModule } from "./features/tags/tags.module";
import { TasksModule } from "./features/tasks/tasks.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),   // §4.5 per-tz reminder cron sweep
    InfraModule,
    AdaModule,
    DevicesModule,
    FeedbackModule,
    FilesModule,
    FocusModule,
    HealthModule,
    IntegrationsModule,
    MoodModule,
    NotificationsModule,
    OnboardingModule,
    PrismModule,
    ProfileModule,
    RealtimeModule,
    ReferralsModule,
    SemestersModule,
    SettingsModule,
    StreaksModule,
    SubjectsModule,
    SyncModule,
    TagsModule,
    TasksModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },          // §4.1 global JWT
    { provide: APP_INTERCEPTOR, useClass: ContextInterceptor }, // §3 tenancy
    { provide: APP_FILTER, useClass: HttpExceptionFilter },     // uniform error shape
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // §2.1/§4.6: rate-limit + idempotency on all routes (strict on /auth/*).
    consumer.apply(RateLimitMiddleware, IdempotencyMiddleware).forRoutes("*");
  }
}

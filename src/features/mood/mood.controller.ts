import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MoodService } from './mood.service';
import { LogMoodDto, ReflectionDto } from './dto/mood.dto';

/** §2.7 — base route: /v1/mood-entries. Static routes before `:date`. */
@Controller('mood-entries')
export class MoodController {
  constructor(private readonly svc: MoodService) {}

  @Get('week')
  week(@Query('date') date?: string) {
    return this.svc.week(date);
  }

  @Get('today')
  today(@Query('field') field?: string) {
    return this.svc.today(field);
  }

  @Post()
  log(@Body() dto: LogMoodDto) {
    return this.svc.log(dto);
  }

  @Post(':date/reflection')
  reflect(@Param('date') date: string, @Body() dto: ReflectionDto) {
    return this.svc.reflect(date, dto);
  }

  @Get(':date')
  getDay(@Param('date') date: string) {
    return this.svc.getDay(date);
  }
}

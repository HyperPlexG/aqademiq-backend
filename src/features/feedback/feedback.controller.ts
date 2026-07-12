import { Body, Controller, Post } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { RateDto, FeedbackDto, TelemetryDto } from './dto/feedback.dto';

/** §2.12 — root-level feedback routes. */
@Controller('/')
export class FeedbackController {
  constructor(private readonly svc: FeedbackService) {}

  @Post('ratings')
  rate(@Body() dto: RateDto) {
    return this.svc.rate(dto);
  }

  @Post('feedback')
  feedback(@Body() dto: FeedbackDto) {
    return this.svc.feedback(dto);
  }

  @Post('telemetry/events')
  telemetry(@Body() dto: TelemetryDto) {
    return this.svc.telemetry(dto);
  }
}

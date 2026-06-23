import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/profile.dto';

/** §2.8 — base route: /v1/profile */
@Controller('profile')
export class ProfileController {
  constructor(private readonly svc: ProfileService) {}

  @Get()
  get() {
    return this.svc.get();
  }

  @Patch()
  update(@Body() dto: UpdateProfileDto) {
    return this.svc.update(dto);
  }
}

import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto, UpdateDeviceDto } from './dto/devices.dto';

/** §2.9/§4.5 — base route: /v1/devices */
@Controller('devices')
export class DevicesController {
  constructor(private readonly svc: DevicesService) {}

  @Post()
  register(@Body() dto: RegisterDeviceDto) {
    return this.svc.register(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.svc.heartbeat(id, dto);
  }
}

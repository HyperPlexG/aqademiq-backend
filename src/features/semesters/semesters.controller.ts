import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SemestersService } from './semesters.service';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semesters.dto';

/** §2.3 — base route: /v1/semesters. Static `active` declared before `:id`. */
@Controller('semesters')
export class SemestersController {
  constructor(private readonly svc: SemestersService) {}

  @Get('active')
  getActive() {
    return this.svc.getActive();
  }

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: CreateSemesterDto) {
    return this.svc.create(dto);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.svc.activate(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSemesterDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

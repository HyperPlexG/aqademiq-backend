import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto, ReorderSubjectsDto } from './dto/subjects.dto';

/** §2.3 — base route: /v1/subjects. Static `reorder` declared before `:id`. */
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly svc: SubjectsService) {}

  @Get()
  list(@Query('semester_id') semesterId?: string) {
    return this.svc.list(semesterId);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderSubjectsDto) {
    return this.svc.reorder(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@Body() dto: CreateSubjectDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/files')
  addFile(@Param('id') id: string, @Body() body: { name?: string; kind?: string; important?: boolean }) {
    return this.svc.addFile(id, body);
  }

  @Post(':id/files/scan')
  scanFile() {
    return this.svc.scanFile();
  }
}

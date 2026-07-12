import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/tags.dto';

/** §2.8 — base route: /v1/study-tags */
@Controller('study-tags')
export class TagsController {
  constructor(private readonly svc: TagsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.svc.create(dto);
  }

  @Delete(':label')
  remove(@Param('label') label: string) {
    return this.svc.remove(label);
  }
}

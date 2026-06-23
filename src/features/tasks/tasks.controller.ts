import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  QueryTasksDto,
  PatchTaskDto,
  ToggleTaskDto,
  MoveTasksDto,
  BreakdownDto,
} from './dto/tasks.dto';

/** §2.2/§4.2 — base route: /v1/tasks. Static routes declared before `:occ`
 *  so they aren't shadowed by the dynamic occurrence-id param. */
@Controller('tasks')
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Get('history/completions')
  completions() {
    return this.svc.completions();
  }

  @Get()
  query(@Query() q: QueryTasksDto) {
    return this.svc.query(q);
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.svc.create(dto);
  }

  @Post('move')
  move(@Body() dto: MoveTasksDto) {
    return this.svc.move(dto);
  }

  @Patch(':occ/toggle')
  toggle(@Param('occ') occ: string, @Query() q: ToggleTaskDto) {
    return this.svc.toggle(occ, q);
  }

  @Post(':occ/breakdown')
  breakdown(@Param('occ') occ: string, @Body() dto: BreakdownDto) {
    return this.svc.breakdown(occ, dto);
  }

  @Patch(':occ')
  patch(@Param('occ') occ: string, @Body() dto: PatchTaskDto) {
    return this.svc.patch(occ, dto);
  }

  @Delete(':occ')
  remove(@Param('occ') occ: string) {
    return this.svc.remove(occ);
  }
}

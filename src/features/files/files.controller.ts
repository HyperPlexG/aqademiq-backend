import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { FilesService } from './files.service';
import { InitUploadDto, PatchFileDto } from './dto/files.dto';

/** §2.3/§4.4 — root-level file routes. */
@Controller('/')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  @Post('uploads/init')
  initUpload(@Body() dto: InitUploadDto) {
    return this.svc.initUpload(dto);
  }

  @Post('uploads/:id/commit')
  commitUpload(@Param('id') id: string) {
    return this.svc.commitUpload(id);
  }

  @Delete('files/:id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Patch('files/:id')
  patch(@Param('id') id: string, @Body() dto: PatchFileDto) {
    return this.svc.patch(id, dto);
  }

  @Get('files/:id/download')
  download(@Param('id') id: string) {
    return this.svc.download(id);
  }

  @Get('files/:id/thumbnail')
  thumbnail() {
    return this.svc.thumbnail();
  }
}

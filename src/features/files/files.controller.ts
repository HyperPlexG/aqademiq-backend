import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { FilesService } from './files.service';
import { InitUploadDto, InitStagingUploadDto, PatchFileDto } from './dto/files.dto';

/** §2.3/§4.4 — root-level file routes. */
@Controller('/')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  @Post('uploads/init')
  initUpload(@Body() dto: InitUploadDto) {
    return this.svc.initUpload(dto);
  }

  /** No subject_id required yet — used by onboarding step 3 (upload syllabus
   *  before any subject exists). Client PUTs the file, then passes the
   *  returned `key` into `POST /onboarding/complete`. */
  @Post('uploads/staging/init')
  initStagingUpload(@Body() dto: InitStagingUploadDto) {
    return this.svc.initStagingUpload(dto);
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
  thumbnail(@Param('id') id: string) {
    return this.svc.thumbnail(id);
  }
}

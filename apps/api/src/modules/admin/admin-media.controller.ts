import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';

import { AdminMediaService } from './admin-media.service';
import { CurrentUserId } from '../auth/current-user.decorator';
import { MAX_UPLOAD_BYTES } from '../content/media-storage.service';
import { MediaListQueryDto, MediaMetadataDto, RegisterExternalMediaDto } from './dto/admin.dto';
import { Roles } from '../auth/roles.decorator';

@ApiTags('admin')
@Roles('EDITOR', 'ADMIN')
@Controller({ path: 'admin/media', version: '1' })
export class AdminMediaController {
  constructor(private readonly media: AdminMediaService) {}

  @Get()
  list(@Query() query: MediaListQueryDto) {
    return this.media.list(query);
  }

  /** multipart/form-data: `file` plus altText, license and optional credit/sourceUrl. */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() metadata: MediaMetadataDto,
    @CurrentUserId() actorId: string
  ) {
    return this.media.upload(file, metadata, actorId);
  }

  @Post('external')
  registerExternal(@Body() dto: RegisterExternalMediaDto, @CurrentUserId() actorId: string) {
    return this.media.registerExternal(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MediaMetadataDto,
    @CurrentUserId() actorId: string
  ) {
    return this.media.update(id, dto, actorId);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUserId() actorId: string) {
    return this.media.remove(id, actorId);
  }
}

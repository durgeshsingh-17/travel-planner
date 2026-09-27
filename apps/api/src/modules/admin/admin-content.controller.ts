import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminContentService } from './admin-content.service';
import {
  AdminListQueryDto,
  UpdateCollectionDto,
  UpdateDestinationDto,
  UpdatePackageDto,
  UpdatePlaceDto
} from './dto/admin.dto';
import { PackageDocumentDto } from '../content/documents/package-document.dto';
import { CollectionDocumentDto } from '../content/documents/collection-document.dto';
import { CurrentUserId } from '../auth/current-user.decorator';
import { DestinationDocumentDto } from '../content/documents/destination-document.dto';
import { PlaceDocumentDto } from '../content/documents/place-document.dto';
import { Roles } from '../auth/roles.decorator';
import { TagDocumentDto } from '../content/documents/tag-document.dto';

const uuid = new ParseUUIDPipe();

@ApiTags('admin')
@Roles('EDITOR', 'ADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  @Get('content-health')
  contentHealth() {
    return this.content.contentHealthOverview();
  }

  // Destinations

  @Get('destinations')
  listDestinations(@Query() query: AdminListQueryDto) {
    return this.content.listDestinations(query);
  }

  @Get('destinations/:id')
  getDestination(@Param('id', uuid) id: string) {
    return this.content.getDestination(id);
  }

  @Post('destinations')
  createDestination(@Body() doc: DestinationDocumentDto, @CurrentUserId() actorId: string) {
    return this.content.createDestination(doc, actorId);
  }

  @Put('destinations/:id')
  updateDestination(
    @Param('id', uuid) id: string,
    @Body() { expectedUpdatedAt, ...doc }: UpdateDestinationDto,
    @CurrentUserId() actorId: string
  ) {
    return this.content.updateDestination(id, doc, actorId, expectedUpdatedAt);
  }

  @Post('destinations/:id/publish')
  publishDestination(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.setStatus('DESTINATION', id, 'PUBLISHED', actorId);
  }

  @Post('destinations/:id/unpublish')
  unpublishDestination(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.setStatus('DESTINATION', id, 'DRAFT', actorId);
  }

  @Post('destinations/:id/archive')
  archiveDestination(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.setStatus('DESTINATION', id, 'ARCHIVED', actorId);
  }

  @Roles('ADMIN')
  @Delete('destinations/:id')
  deleteDestination(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.remove('DESTINATION', id, actorId);
  }

  // Places

  @Get('places')
  listPlaces(@Query() query: AdminListQueryDto) {
    return this.content.listPlaces(query);
  }

  @Get('places/:id')
  getPlace(@Param('id', uuid) id: string) {
    return this.content.getPlace(id);
  }

  @Post('places')
  createPlace(@Body() doc: PlaceDocumentDto, @CurrentUserId() actorId: string) {
    return this.content.createPlace(doc, actorId);
  }

  @Put('places/:id')
  updatePlace(
    @Param('id', uuid) id: string,
    @Body() { expectedUpdatedAt, ...doc }: UpdatePlaceDto,
    @CurrentUserId() actorId: string
  ) {
    return this.content.updatePlace(id, doc, actorId, expectedUpdatedAt);
  }

  @Post('places/:id/publish')
  publishPlace(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.setStatus('PLACE', id, 'PUBLISHED', actorId);
  }

  @Post('places/:id/unpublish')
  unpublishPlace(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.setStatus('PLACE', id, 'DRAFT', actorId);
  }

  @Roles('ADMIN')
  @Delete('places/:id')
  deletePlace(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.remove('PLACE', id, actorId);
  }

  // Collections

  @Get('collections')
  listCollections(@Query() query: AdminListQueryDto) {
    return this.content.listCollections(query);
  }

  @Get('collections/:id')
  getCollection(@Param('id', uuid) id: string) {
    return this.content.getCollection(id);
  }

  @Post('collections')
  createCollection(@Body() doc: CollectionDocumentDto, @CurrentUserId() actorId: string) {
    return this.content.createCollection(doc, actorId);
  }

  @Put('collections/:id')
  updateCollection(
    @Param('id', uuid) id: string,
    @Body() { expectedUpdatedAt, ...doc }: UpdateCollectionDto,
    @CurrentUserId() actorId: string
  ) {
    return this.content.updateCollection(id, doc, actorId, expectedUpdatedAt);
  }

  @Post('collections/:id/publish')
  publishCollection(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.setStatus('COLLECTION', id, 'PUBLISHED', actorId);
  }

  @Post('collections/:id/unpublish')
  unpublishCollection(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.setStatus('COLLECTION', id, 'DRAFT', actorId);
  }

  @Roles('ADMIN')
  @Delete('collections/:id')
  deleteCollection(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.remove('COLLECTION', id, actorId);
  }

  // Packages

  @Get('packages')
  listPackages(@Query() query: AdminListQueryDto) {
    return this.content.listPackages(query);
  }

  @Get('packages/:id')
  getPackage(@Param('id', uuid) id: string) {
    return this.content.getPackage(id);
  }

  @Post('packages')
  createPackage(@Body() doc: PackageDocumentDto, @CurrentUserId() actorId: string) {
    return this.content.createPackage(doc, actorId);
  }

  @Put('packages/:id')
  updatePackage(
    @Param('id', uuid) id: string,
    @Body() { expectedUpdatedAt, ...doc }: UpdatePackageDto,
    @CurrentUserId() actorId: string
  ) {
    return this.content.updatePackage(id, doc, actorId, expectedUpdatedAt);
  }

  @Post('packages/:id/publish')
  publishPackage(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.setStatus('PACKAGE', id, 'PUBLISHED', actorId);
  }

  @Post('packages/:id/unpublish')
  unpublishPackage(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.setStatus('PACKAGE', id, 'DRAFT', actorId);
  }

  @Roles('ADMIN')
  @Delete('packages/:id')
  deletePackage(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.remove('PACKAGE', id, actorId);
  }

  // Tags

  @Get('tags')
  listTags() {
    return this.content.listTags();
  }

  @Post('tags')
  createTag(@Body() doc: TagDocumentDto, @CurrentUserId() actorId: string) {
    return this.content.saveTag(doc, actorId);
  }

  @Put('tags/:id')
  updateTag(@Param('id', uuid) id: string, @Body() doc: TagDocumentDto, @CurrentUserId() actorId: string) {
    return this.content.saveTag(doc, actorId, id);
  }

  @Roles('ADMIN')
  @Delete('tags/:id')
  deleteTag(@Param('id', uuid) id: string, @CurrentUserId() actorId: string) {
    return this.content.removeTag(id, actorId);
  }
}

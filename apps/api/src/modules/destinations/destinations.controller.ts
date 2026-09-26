import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { DestinationsService, Resolved } from './destinations.service';
import {
  ListDestinationPlacesQueryDto,
  ListDestinationsQueryDto
} from './dto/list-destinations-query.dto';
import { Public } from '../auth/public.decorator';

const SLUG = /^[a-z0-9-]{1,80}$/;

@ApiTags('destinations')
@Public()
@Controller({
  path: 'destinations',
  version: '1'
})
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get()
  findAll(@Query() query: ListDestinationsQueryDto) {
    return this.destinationsService.findAll(query);
  }

  @Get('facets')
  facets() {
    return this.destinationsService.facets();
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string, @Res({ passthrough: true }) response: Response) {
    return this.respond(await this.destinationsService.findBySlug(this.slug(slug)), response);
  }

  @Get(':slug/places')
  findPlaces(@Param('slug') slug: string, @Query() query: ListDestinationPlacesQueryDto) {
    return this.destinationsService.findPlaces(this.slug(slug), query);
  }

  @Get(':slug/places/:placeSlug')
  async findPlace(
    @Param('slug') slug: string,
    @Param('placeSlug') placeSlug: string,
    @Res({ passthrough: true }) response: Response
  ) {
    return this.respond(
      await this.destinationsService.findPlace(this.slug(slug), this.slug(placeSlug)),
      response
    );
  }

  /**
   * Renamed content answers 301 with the new API location. HTTP clients follow
   * it transparently; the page then sees the new slug and updates its URL.
   */
  private respond(result: Resolved<unknown>, response: Response) {
    if ('redirectTo' in result) {
      response.status(301).location(`/api/v1/destinations/${result.redirectTo}`);
      return { redirectTo: result.redirectTo };
    }

    response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
    return result.data;
  }

  private slug(value: string): string {
    // Anything that cannot be a slug cannot exist; answer like any other miss.
    return SLUG.test(value) ? value : '-invalid-';
  }
}

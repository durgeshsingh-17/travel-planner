import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { ListPackagesQueryDto } from './dto/list-packages-query.dto';
import { PackagesService } from './packages.service';
import { Public } from '../auth/public.decorator';

@ApiTags('packages')
@Public()
@Controller({ path: 'packages', version: '1' })
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  findAll(@Query() query: ListPackagesQueryDto) {
    return this.packages.findAll(query);
  }

  @Get('facets')
  facets() {
    return this.packages.facets();
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.packages.findBySlug(/^[a-z0-9-]{1,100}$/.test(slug) ? slug : '-invalid-');

    if ('redirectTo' in result) {
      response.status(301).location(`/api/v1/packages/${result.redirectTo}`);
      return result;
    }

    response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
    return result.data;
  }
}

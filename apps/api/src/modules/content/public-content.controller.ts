import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TagKind } from '@prisma/client';
import { Response } from 'express';

import { Public } from '../auth/public.decorator';
import { PublicContentService } from './public-content.service';

const CACHE_SHORT = 'public, max-age=60, stale-while-revalidate=600';

@ApiTags('content')
@Public()
@Controller({ version: '1' })
export class PublicContentController {
  constructor(private readonly content: PublicContentService) {}

  @Get('collections')
  collections(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', CACHE_SHORT);
    return this.content.collections();
  }

  @Get('collections/:slug')
  async collection(@Param('slug') slug: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.content.collection(/^[a-z0-9-]{1,80}$/.test(slug) ? slug : '-invalid-');

    if ('redirectTo' in result) {
      response.status(301).location(`/api/v1/collections/${result.redirectTo}`);
      return result;
    }

    response.setHeader('Cache-Control', CACHE_SHORT);
    return result.data;
  }

  @Get('tags')
  tags(@Query('kind') kind?: string) {
    if (kind && !(kind in TagKind)) {
      throw new BadRequestException(`kind must be one of ${Object.keys(TagKind).join(', ')}`);
    }

    return this.content.tags(kind as TagKind | undefined);
  }

  @Get('search/suggest')
  suggest(@Query('q') q = '') {
    return this.content.suggest(q.slice(0, 60));
  }

  @Get('home')
  home(@Res({ passthrough: true }) response: Response, @Query('month') month?: string) {
    const parsed = month ? Number(month) : undefined;

    if (parsed !== undefined && !(Number.isInteger(parsed) && parsed >= 1 && parsed <= 12)) {
      throw new BadRequestException('month must be 1-12');
    }

    response.setHeader('Cache-Control', CACHE_SHORT);
    return this.content.home(parsed);
  }

  @Get('seo/sitemap-entries')
  sitemapEntries(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'public, max-age=300');
    return this.content.sitemapEntries();
  }
}

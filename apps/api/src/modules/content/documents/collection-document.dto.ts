import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested
} from 'class-validator';

import { MediaRefDto, SLUG_MESSAGE, SLUG_PATTERN, SeoFieldsDto } from './common.dto';

/** A destination, or a place within a destination (ids from the editor, slugs from imports). */
export class CollectionItemInputDto {
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @IsOptional()
  @IsUUID()
  placeId?: string;

  @ValidateIf((item: CollectionItemInputDto) => !item.destinationId && !item.placeId)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  destinationSlug?: string;

  @IsOptional()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  placeSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  blurb?: string | null;
}

export class CollectionDocumentDto extends SeoFieldsDto {
  @IsString()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(600)
  intro!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => CollectionItemInputDto)
  items?: CollectionItemInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MediaRefDto)
  media?: MediaRefDto[];
}

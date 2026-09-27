import { PackageTierLevel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import { PageQueryDto } from '../../destinations/dto/list-destinations-query.dto';

const toArray = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Array.isArray(value) ? value : String(value).split(',');

export const PACKAGE_SORTS = ['popular', 'price_asc', 'price_desc', 'duration', 'rating'] as const;

export class ListPackagesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** Destination slug the package visits. */
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/)
  destination?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(59)
  nightsMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(59)
  nightsMax?: number;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @Matches(/^[a-z0-9-]+$/, { each: true })
  tag?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsEnum(PackageTierLevel)
  tier?: PackageTierLevel;

  @IsOptional()
  @IsIn(PACKAGE_SORTS)
  sort?: (typeof PACKAGE_SORTS)[number];
}

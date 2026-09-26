import { PlaceCategory } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';

const toArray = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Array.isArray(value) ? value : String(value).split(',');

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize?: number;
}

export class ListDestinationsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string;

  /** Theme slugs; a destination matches if it has any of them. `tag=a,b` or repeated. */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @Matches(/^[a-z0-9-]+$/, { each: true })
  tag?: string[];

  /** Destinations rated a good month to visit. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  /** Trip length in days that should fit the destination's ideal duration. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;

  /** Maximum budget per person per day, in INR. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsIn(['popular', 'name'])
  sort?: 'popular' | 'name';

  /** @deprecated Use pageSize. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number;
}

export class ListDestinationPlacesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;

  @IsOptional()
  @Matches(/^[a-z0-9-]+$/)
  tag?: string;
}

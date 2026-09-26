import { PlaceCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested
} from 'class-validator';

import {
  CLOCK_PATTERN,
  FaqInputDto,
  MediaRefDto,
  SLUG_MESSAGE,
  SLUG_PATTERN,
  SeoFieldsDto
} from './common.dto';

export class PlaceTimingDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @ValidateIf((timing: PlaceTimingDto) => !timing.isClosed)
  @Matches(CLOCK_PATTERN, { message: 'opensAt must be HH:mm (24-hour)' })
  opensAt?: string | null;

  @ValidateIf((timing: PlaceTimingDto) => !timing.isClosed)
  @Matches(CLOCK_PATTERN, { message: 'closesAt must be HH:mm (24-hour)' })
  closesAt?: string | null;
}

export class PlaceDocumentDto extends SeoFieldsDto {
  /** Editors send the id; imports usually send the slug. One is required. */
  @ValidateIf((doc: PlaceDocumentDto) => !doc.destinationSlug)
  @IsUUID()
  destinationId?: string;

  @ValidateIf((doc: PlaceDocumentDto) => !doc.destinationId)
  @IsString()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  destinationSlug?: string;

  @IsString()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEnum(PlaceCategory)
  category!: PlaceCategory;

  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  overview?: string | null;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  rankInDestination?: number | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  averageVisitMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  timeRequiredMinMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  timeRequiredMaxMinutes?: number | null;

  /** Rough spend per person used by the trip cost estimate. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  estimatedCost?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  entryFeeIndian?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  entryFeeChild?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  entryFeeForeigner?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  feeNotes?: string | null;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bestTimeOfDay?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  tips?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(SLUG_PATTERN, { each: true, message: 'Each tag must be a tag slug' })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => PlaceTimingDto)
  timings?: PlaceTimingDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => FaqInputDto)
  faqs?: FaqInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => MediaRefDto)
  media?: MediaRefDto[];
}

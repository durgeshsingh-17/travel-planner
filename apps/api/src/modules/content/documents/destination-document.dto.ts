import { MonthRating, ReachMode } from '@prisma/client';
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
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

import { FaqInputDto, MediaRefDto, SLUG_MESSAGE, SLUG_PATTERN, SeoFieldsDto } from './common.dto';

export class MonthInfoDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsEnum(MonthRating)
  rating!: MonthRating;

  @IsOptional()
  @IsInt()
  @Min(-50)
  @Max(60)
  avgMinC?: number | null;

  @IsOptional()
  @IsInt()
  @Min(-50)
  @Max(60)
  avgMaxC?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  rainfallMm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  events?: string[];
}

export class HowToReachDto {
  @IsEnum(ReachMode)
  mode!: ReachMode;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  hubName!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  distanceKm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7200)
  durationMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  costMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  costMax?: number | null;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary!: string;
}

/**
 * Full editable content of a destination. Nested arrays that are omitted are
 * left unchanged; an empty array clears them.
 */
export class DestinationDocumentDto extends SeoFieldsDto {
  @IsString()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  state!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  @MinLength(20)
  @MaxLength(300)
  shortDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tagline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  overview?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  idealDaysMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  idealDaysMax?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  budgetPerDayMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  budgetPerDayMax?: number | null;

  @IsOptional()
  @IsInt()
  @Min(-500)
  @Max(9000)
  altitudeM?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nearestAirport?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  nearestAirportKm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nearestRailway?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  nearestRailwayKm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bestTimeToVisit?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  heroImageUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  popularityScore?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(SLUG_PATTERN, { each: true, message: 'Each tag must be a tag slug' })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => MonthInfoDto)
  months?: MonthInfoDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => HowToReachDto)
  howToReach?: HowToReachDto[];

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

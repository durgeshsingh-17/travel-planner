import { MealPlan, PackageTierLevel, PolicyKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

import { FaqInputDto, MediaRefDto, SLUG_MESSAGE, SLUG_PATTERN, SeoFieldsDto } from './common.dto';

export class PackageRouteStopDto {
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  destinationSlug!: string;

  @IsInt()
  @Min(0)
  @Max(30)
  nights!: number;
}

export class PackageTierDto {
  @IsEnum(PackageTierLevel)
  level!: PackageTierLevel;

  @IsInt()
  @Min(1)
  @Max(10_000_000)
  pricePerPerson!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  compareAtPrice?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  childPrice?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  singleSupplement?: number | null;

  @IsOptional()
  @IsBoolean()
  taxesIncluded?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  hotelCategory?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  transportNote?: string | null;
}

export class PackageDayPlaceDto {
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  destinationSlug!: string;

  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  placeSlug!: string;
}

export class PackageDayDto {
  @IsInt()
  @Min(1)
  @Max(60)
  dayNumber!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description!: string;

  @IsOptional()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  overnightDestinationSlug?: string | null;

  @IsOptional()
  @IsArray()
  @IsIn(['B', 'L', 'D'], { each: true })
  mealsIncluded?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PackageDayPlaceDto)
  places?: PackageDayPlaceDto[];
}

export class PackageStayDto {
  @IsEnum(PackageTierLevel)
  tierLevel!: PackageTierLevel;

  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  destinationSlug!: string;

  @IsInt()
  @Min(1)
  @Max(30)
  nights!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  hotelName!: string;

  @IsOptional()
  @IsBoolean()
  orSimilar?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  hotelCategory?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  roomType?: string | null;

  @IsEnum(MealPlan)
  mealPlan!: MealPlan;
}

export class PackagePolicyDto {
  @IsEnum(PolicyKind)
  kind!: PolicyKind;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  body!: string;
}

/**
 * Full editable content of a package. Destinations and places are referenced by
 * slug. Nested arrays that are omitted are left unchanged; an empty array clears them.
 */
export class PackageDocumentDto extends SeoFieldsDto {
  @IsString()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(100)
  slug!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(400)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  overview?: string | null;

  @IsInt()
  @Min(1)
  @Max(60)
  durationDays!: number;

  @IsInt()
  @Min(0)
  @Max(59)
  durationNights!: number;

  @IsOptional()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  startLocationSlug?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  availableMonths?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  minPax?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxPax?: number | null;

  @IsOptional()
  @IsBoolean()
  isCustomizable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  popularityScore?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(SLUG_PATTERN, { each: true, message: 'Each tag must be a tag slug' })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PackageRouteStopDto)
  route?: PackageRouteStopDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => PackageTierDto)
  tiers?: PackageTierDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => PackageDayDto)
  days?: PackageDayDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => PackageStayDto)
  stays?: PackageStayDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  inclusions?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  exclusions?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => PackagePolicyDto)
  policies?: PackagePolicyDto[];

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


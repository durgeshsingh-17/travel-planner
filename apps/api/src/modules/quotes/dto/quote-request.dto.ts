import { PackageTierLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsBoolean,
  IsArray,
  IsDateString,
  IsEmail,
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
  ValidateIf,
  ValidateNested
} from 'class-validator';

import { PERSON_NAME_PATTERN } from '../../../common/validators/identity.patterns';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateQuoteRequestDto {
  /** A package, or at least a destination, is required. */
  @ValidateIf((dto: CreateQuoteRequestDto) => !dto.destinationSlug)
  @Matches(SLUG)
  packageSlug?: string;

  @IsOptional()
  @IsEnum(PackageTierLevel)
  packageTier?: PackageTierLevel;

  @ValidateIf((dto: CreateQuoteRequestDto) => !dto.packageSlug)
  @Matches(SLUG)
  destinationSlug?: string;

  @IsOptional()
  @Matches(SLUG)
  departureLocationSlug?: string;

  /** Either a start date or a flexible month. */
  @ValidateIf((dto: CreateQuoteRequestDto) => dto.flexibleMonth === undefined)
  @IsDateString({ strict: true })
  startDate?: string;

  @ValidateIf((dto: CreateQuoteRequestDto) => !dto.startDate)
  @IsInt()
  @Min(1)
  @Max(12)
  flexibleMonth?: number;

  @IsInt()
  @Min(1)
  @Max(60)
  nights!: number;

  @IsInt()
  @Min(1)
  @Max(30)
  adults!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(17, { each: true })
  childAges?: number[];

  @IsInt()
  @Min(1)
  @Max(20)
  rooms!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  budgetPerPersonMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  budgetPerPersonMax?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  hotelCategory?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsString()
  @MinLength(2)
  @Matches(PERSON_NAME_PATTERN, { message: 'Name can contain letters, spaces, apostrophes, dots and hyphens only' })
  contactName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  /** Explicit consent to share the request with up to 3 agencies. */
  @Equals(true, { message: 'Please agree to share your request with travel agencies' })
  consent!: boolean;

  @IsOptional()
  @IsIn(['PACKAGE', 'DESTINATION', 'TRIP', 'DIRECT'])
  source?: string;
}

export class HotelLineDto {
  @IsString()
  @MaxLength(80)
  destinationName!: string;

  @IsString()
  @MaxLength(120)
  hotelName!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  hotelCategory?: number;

  @IsOptional()
  @IsIn(['EP', 'CP', 'MAP', 'AP'])
  mealPlan?: string;

  @IsInt()
  @Min(1)
  @Max(30)
  nights!: number;
}

export class SubmitQuoteDto {
  @IsOptional()
  @IsEnum(PackageTierLevel)
  tier?: PackageTierLevel;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  totalPrice!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  pricePerPerson?: number;

  @IsOptional()
  @IsBoolean()
  taxesIncluded?: boolean;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HotelLineDto)
  hotels!: HotelLineDto[];

  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  inclusions!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  exclusions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsDateString()
  validUntil!: string;
}

export class DeclineRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

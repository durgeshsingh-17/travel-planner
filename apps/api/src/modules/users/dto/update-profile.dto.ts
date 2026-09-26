import { TravelMode, TravelPace } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf
} from 'class-validator';

export const DIETARY_PREFERENCES = ['VEG', 'NON_VEG', 'EGGETARIAN', 'JAIN', 'VEGAN'] as const;
export const BUDGET_BANDS = ['BUDGET', 'MID_RANGE', 'PREMIUM'] as const;

const isProvided = (_: unknown, value: unknown) => value !== null && value !== undefined;

/** Every field is optional; `null` clears a nullable field. */
export class UpdateProfileDto {
  @ValidateIf(isProvided)
  @IsUUID()
  homeLocationId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  interests?: string[];

  @IsOptional()
  @IsEnum(TravelPace)
  pace?: TravelPace;

  @ValidateIf(isProvided)
  @IsIn(DIETARY_PREFERENCES)
  dietaryPreference?: (typeof DIETARY_PREFERENCES)[number] | null;

  @ValidateIf(isProvided)
  @IsIn(BUDGET_BANDS)
  budgetBand?: (typeof BUDGET_BANDS)[number] | null;

  @ValidateIf(isProvided)
  @IsEnum(TravelMode)
  preferredTravelMode?: TravelMode | null;

  @ValidateIf(isProvided)
  @IsUUID()
  defaultUserVehicleId?: string | null;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
import { TravelMode, TravelPace } from '@prisma/client';
import { Type } from 'class-transformer';

import { TripLocationDto } from './trip-location.dto';
import { TripTravellerInputDto } from './trip-traveller-input.dto';

export class PreviewTripDto {
  @ValidateNested()
  @Type(() => TripLocationDto)
  source!: TripLocationDto;

  @ValidateNested()
  @Type(() => TripLocationDto)
  destination!: TripLocationDto;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsInt()
  @Min(1)
  travellerCount!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TripTravellerInputDto)
  travellers!: TripTravellerInputDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsEnum(TravelMode)
  travelMode!: TravelMode;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  interests!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferences?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  /** Stops per day: relaxed 2, balanced 3, packed 4. Defaults to the traveller's profile. */
  @IsOptional()
  @IsEnum(TravelPace)
  pace?: TravelPace;

  /** Longest drive per day before the plan adds an overnight halt. */
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(14)
  maxDriveHoursPerDay?: number;
}

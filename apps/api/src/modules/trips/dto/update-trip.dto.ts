import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsArray,
  IsString,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';
import { TravelMode, TripStatus } from '@prisma/client';
import { Type } from 'class-transformer';

import { TripLocationDto } from './trip-location.dto';
import { TripTravellerInputDto } from './trip-traveller-input.dto';

export class UpdateTripDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TripLocationDto)
  source?: TripLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TripLocationDto)
  destination?: TripLocationDto;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  travellerCount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripTravellerInputDto)
  travellers?: TripTravellerInputDto[];

  @IsOptional()
  @IsEnum(TravelMode)
  travelMode?: TravelMode;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferences?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;
}

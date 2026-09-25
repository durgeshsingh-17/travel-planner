import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from 'class-validator';
import { TravelMode } from '@prisma/client';
import { Type } from 'class-transformer';

import { TripLocationDto } from './trip-location.dto';
import { TripTravellerInputDto } from './trip-traveller-input.dto';
import { TripVehicleInputDto } from './trip-vehicle-input.dto';

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

  @IsOptional()
  @ValidateNested()
  @Type(() => TripVehicleInputDto)
  vehicle?: TripVehicleInputDto;

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
}

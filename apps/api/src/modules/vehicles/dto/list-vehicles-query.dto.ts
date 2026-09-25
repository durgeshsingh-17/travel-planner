import { IsEnum, IsOptional } from 'class-validator';
import { FuelType, VehicleType } from '@prisma/client';

export class ListVehiclesQueryDto {
  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType;
}

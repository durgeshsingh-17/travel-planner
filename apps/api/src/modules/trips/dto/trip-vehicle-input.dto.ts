import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TripVehicleInputDto {
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  mileage?: number;
}

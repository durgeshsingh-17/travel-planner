import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength
} from 'class-validator';

export class CreateUserVehicleDto {
  @IsUUID()
  vehicleId!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  nickname?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  customMileage?: number;

  @IsOptional()
  @IsString()
  registrationNumber?: string;
}

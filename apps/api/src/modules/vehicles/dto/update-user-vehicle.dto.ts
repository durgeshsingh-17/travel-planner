import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength
} from 'class-validator';

const INDIAN_REGISTRATION_PATTERN =
  /^([A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}|\d{2}[\s-]?BH[\s-]?\d{4}[\s-]?[A-Z]{1,2})$/i;

export class UpdateUserVehicleDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

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
  @Matches(INDIAN_REGISTRATION_PATTERN, {
    message: 'Registration number must follow Indian RTO format, for example DL 01 AB 1234'
  })
  registrationNumber?: string;
}

import { IsOptional, IsString, IsUUID } from 'class-validator';

import { PreviewTripDto } from './preview-trip.dto';

export class CreateTripDto extends PreviewTripDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}

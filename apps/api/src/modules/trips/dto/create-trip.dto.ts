import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { PreviewTripDto } from './preview-trip.dto';

export class CreateTripDto extends PreviewTripDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  /** Saved garage entry; its custom mileage drives the fuel estimate. */
  @IsOptional()
  @IsUUID()
  userVehicleId?: string;

  /** @deprecated Catalog vehicle id. Prefer `userVehicleId`. */
  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}

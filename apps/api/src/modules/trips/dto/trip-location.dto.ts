import { IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class TripLocationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsLatitude()
  latitude!: number;

  @IsNumber()
  @IsLongitude()
  longitude!: number;
}

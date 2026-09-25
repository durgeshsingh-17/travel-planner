import { IsDateString, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class WeatherQueryDto {
  @IsString()
  location!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}

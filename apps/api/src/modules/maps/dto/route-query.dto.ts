import { IsLatitude, IsLongitude, IsString } from 'class-validator';

export class RouteQueryDto {
  @IsString()
  sourceName!: string;

  @IsLatitude()
  sourceLatitude!: number;

  @IsLongitude()
  sourceLongitude!: number;

  @IsString()
  destinationName!: string;

  @IsLatitude()
  destinationLatitude!: number;

  @IsLongitude()
  destinationLongitude!: number;
}

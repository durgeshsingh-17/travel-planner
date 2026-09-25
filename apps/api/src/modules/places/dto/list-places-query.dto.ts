import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PlaceCategory } from '@prisma/client';

export class ListPlacesQueryDto {
  @IsOptional()
  @IsString()
  destinationSlug?: string;

  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;
}

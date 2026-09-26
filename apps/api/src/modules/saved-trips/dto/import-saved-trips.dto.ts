import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class ImportSavedTripsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  tripIds!: string[];
}

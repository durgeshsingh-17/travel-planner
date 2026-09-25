import { IsOptional, IsString } from 'class-validator';

export class ListDestinationsQueryDto {
  @IsOptional()
  @IsString()
  state?: string;
}

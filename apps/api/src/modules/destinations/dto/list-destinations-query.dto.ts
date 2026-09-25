import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDestinationsQueryDto {
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

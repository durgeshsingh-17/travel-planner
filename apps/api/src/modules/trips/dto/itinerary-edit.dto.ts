import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const MAX_ACTIVITIES_PER_DAY = 20;

export class ReorderDayDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ACTIVITIES_PER_DAY)
  @IsUUID('all', { each: true })
  activityIds!: string[];
}

export class AddActivityDto {
  /** A published place; leave empty for a custom stop with a title. */
  @IsOptional()
  @IsUUID('all')
  placeId?: string;

  @ValidateIf((dto: AddActivityDto) => !dto.placeId)
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(600)
  durationMinutes?: number;

  /** 1-based position in the day; defaults to before the evening meal or drive. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ACTIVITIES_PER_DAY)
  position?: number;
}

export class UpdateActivityDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(600)
  durationMinutes?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:mm' })
  startTime?: string;

  /** Move to another day of the same trip. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  dayNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ACTIVITIES_PER_DAY)
  position?: number;
}

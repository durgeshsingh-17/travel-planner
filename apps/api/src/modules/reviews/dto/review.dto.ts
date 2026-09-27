import { ReviewStatus, TravellerType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Exactly one target: a package, a destination, or a place (destination + place slug). */
export class ReviewTargetDto {
  @ValidateIf((dto: ReviewTargetDto) => !dto.destinationSlug)
  @Matches(SLUG)
  packageSlug?: string;

  @ValidateIf((dto: ReviewTargetDto) => !dto.packageSlug)
  @Matches(SLUG)
  destinationSlug?: string;

  @IsOptional()
  @Matches(SLUG)
  placeSlug?: string;
}

export class CreateReviewDto extends ReviewTargetDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @MinLength(30, { message: 'Please write at least 30 characters' })
  @MaxLength(3000)
  body!: string;

  /** YYYY-MM */
  @IsOptional()
  @Matches(/^20\d{2}-(0[1-9]|1[0-2])$/, { message: 'travelledMonth must be YYYY-MM' })
  travelledMonth?: string;

  @IsOptional()
  @IsEnum(TravellerType)
  travellerType?: TravellerType;
}

export class UpdateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @MinLength(30)
  @MaxLength(3000)
  body!: string;

  @IsOptional()
  @Matches(/^20\d{2}-(0[1-9]|1[0-2])$/)
  travelledMonth?: string;

  @IsOptional()
  @IsEnum(TravellerType)
  travellerType?: TravellerType;
}

export class ListReviewsQueryDto extends ReviewTargetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

export class ModerateReviewDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: Extract<ReviewStatus, 'APPROVED' | 'REJECTED'>;

  /** Shown to the author when a review is rejected. */
  @ValidateIf((dto: ModerateReviewDto) => dto.decision === 'REJECTED')
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  note?: string;
}

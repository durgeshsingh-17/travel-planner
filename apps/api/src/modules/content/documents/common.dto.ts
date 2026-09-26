import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf
} from 'class-validator';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MESSAGE = 'Slug must be lowercase letters, numbers and single hyphens';
export const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MEDIA_LICENSES = ['OWNED', 'CC0', 'CC-BY', 'CC-BY-SA', 'LICENSED'] as const;

export class SeoFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  seoDescription?: string | null;
}

export class FaqInputDto {
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  question!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  answer!: string;
}

/**
 * Reference to an image. Editors pick existing media by id; imports may give
 * an https URL, which is registered as external media with its licence.
 */
export class MediaRefDto {
  @ValidateIf((ref: MediaRefDto) => !ref.url)
  @IsUUID()
  mediaId?: string;

  @ValidateIf((ref: MediaRefDto) => !ref.mediaId)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  url?: string;

  @ValidateIf((ref: MediaRefDto) => Boolean(ref.url))
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  altText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  credit?: string | null;

  @ValidateIf((ref: MediaRefDto) => Boolean(ref.url))
  @Matches(new RegExp(`^(${MEDIA_LICENSES.join('|')})$`), {
    message: `license must be one of ${MEDIA_LICENSES.join(', ')}`
  })
  license?: string;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}



import { TagKind } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { SLUG_MESSAGE, SLUG_PATTERN } from './common.dto';

export class TagDocumentDto {
  @IsString()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(60)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name!: string;

  @IsOptional()
  @IsEnum(TagKind)
  kind?: TagKind;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;
}

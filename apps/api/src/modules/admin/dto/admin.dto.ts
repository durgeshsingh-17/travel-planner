import { ContentStatus, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

import { CollectionDocumentDto } from '../../content/documents/collection-document.dto';
import { DestinationDocumentDto } from '../../content/documents/destination-document.dto';
import { MEDIA_LICENSES } from '../../content/documents/common.dto';
import { PackageDocumentDto } from '../../content/documents/package-document.dto';
import { PlaceDocumentDto } from '../../content/documents/place-document.dto';

export class AdminListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** Editors send back the `updatedAt` they loaded so concurrent saves are detected. */
export class UpdateDestinationDto extends DestinationDocumentDto {
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class UpdatePlaceDto extends PlaceDocumentDto {
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class UpdatePackageDto extends PackageDocumentDto {
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

export class UpdateCollectionDto extends CollectionDocumentDto {
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}

const LICENSE_PATTERN = new RegExp(`^(${MEDIA_LICENSES.join('|')})$`);

export class MediaMetadataDto {
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  altText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  credit?: string | null;

  @Matches(LICENSE_PATTERN, { message: `license must be one of ${MEDIA_LICENSES.join(', ')}` })
  license!: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  sourceUrl?: string | null;
}

export class RegisterExternalMediaDto extends MediaMetadataDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  height?: number;
}

export class MediaListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

export class SetRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

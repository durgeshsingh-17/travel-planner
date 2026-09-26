import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

import { CollectionDocumentDto } from '../../content/documents/collection-document.dto';
import { DestinationDocumentDto } from '../../content/documents/destination-document.dto';
import { PlaceDocumentDto } from '../../content/documents/place-document.dto';
import { TagDocumentDto } from '../../content/documents/tag-document.dto';

const IMPORT_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export class ImportDestinationDto extends DestinationDocumentDto {
  /** PUBLISHED publishes after saving, if the publish rules pass. Omitted = new rows stay drafts. */
  @IsOptional()
  @IsIn(IMPORT_STATUSES)
  status?: ImportStatus;
}

export class ImportPlaceDto extends PlaceDocumentDto {
  @IsOptional()
  @IsIn(IMPORT_STATUSES)
  status?: ImportStatus;
}

export class ImportCollectionDto extends CollectionDocumentDto {
  @IsOptional()
  @IsIn(IMPORT_STATUSES)
  status?: ImportStatus;
}

export class ImportBundleDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TagDocumentDto)
  tags?: TagDocumentDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportDestinationDto)
  destinations?: ImportDestinationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportPlaceDto)
  places?: ImportPlaceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportCollectionDto)
  collections?: ImportCollectionDto[];
}

export class ImportCsvDto {
  @IsIn(['locations', 'places'])
  entity!: 'locations' | 'places';

  @IsString()
  @MaxLength(5_000_000)
  csv!: string;
}

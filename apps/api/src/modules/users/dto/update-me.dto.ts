import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

import {
  INDIA_PHONE_PATTERN,
  PERSON_NAME_PATTERN
} from '../../../common/validators/identity.patterns';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Matches(PERSON_NAME_PATTERN, {
    message: 'Name can contain letters, spaces, apostrophes, dots and hyphens only'
  })
  name?: string;

  /** Send `null` to remove the phone number. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(INDIA_PHONE_PATTERN, {
    message: 'Phone number must be a valid Indian mobile number'
  })
  phone?: string | null;

  /** Send `null` to remove the avatar. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string | null;
}

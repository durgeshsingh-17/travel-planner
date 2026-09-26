import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import {
  INDIA_PHONE_PATTERN,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PERSON_NAME_PATTERN
} from '../../../common/validators/identity.patterns';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @Matches(PERSON_NAME_PATTERN, {
    message: 'Name can contain letters, spaces, apostrophes, dots and hyphens only'
  })
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(INDIA_PHONE_PATTERN, {
    message: 'Phone number must be a valid Indian mobile number'
  })
  phone?: string;
}

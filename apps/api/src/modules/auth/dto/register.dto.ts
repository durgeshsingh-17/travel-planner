import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const PERSON_NAME_PATTERN = /^[A-Za-z][A-Za-z'. -]{1,78}$/;
const INDIA_PHONE_PATTERN = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @Matches(PERSON_NAME_PATTERN, {
    message: 'Name can contain letters, spaces, apostrophes, dots and hyphens only'
  })
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(INDIA_PHONE_PATTERN, {
    message: 'Phone number must be a valid Indian mobile number'
  })
  phone?: string;
}

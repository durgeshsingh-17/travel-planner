import { IsString, Matches } from 'class-validator';

import { INDIA_PHONE_PATTERN } from '../../../common/validators/identity.patterns';

export class RequestPhoneCodeDto {
  @IsString()
  @Matches(INDIA_PHONE_PATTERN, { message: 'Enter a valid Indian mobile number' })
  phone!: string;
}

export class ConfirmPhoneCodeDto extends RequestPhoneCodeDto {
  @Matches(/^\d{6}$/, { message: 'The code has 6 digits' })
  code!: string;
}

import { IsString, MaxLength, MinLength } from 'class-validator';

import { PASSWORD_MAX_LENGTH } from '../../../common/validators/identity.patterns';

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

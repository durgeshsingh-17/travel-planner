import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { AUTH_THROTTLE } from '../auth/auth.throttle';
import { ConfirmPhoneCodeDto, RequestPhoneCodeDto } from './dto/phone-verification.dto';
import { CurrentUserId } from '../auth/current-user.decorator';
import { OtpService } from './otp.service';

@ApiTags('me')
@Controller({ path: 'me/phone', version: '1' })
export class VerificationController {
  constructor(private readonly otp: OtpService) {}

  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('verification')
  requestCode(@Body() dto: RequestPhoneCodeDto, @Req() request: Request) {
    return this.otp.requestCode(dto.phone, request.ip);
  }

  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('verification/confirm')
  confirm(@CurrentUserId() userId: string, @Body() dto: ConfirmPhoneCodeDto) {
    return this.otp.confirmCode(userId, dto.phone, dto.code);
  }
}

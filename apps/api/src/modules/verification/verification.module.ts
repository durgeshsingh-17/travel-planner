import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LogSmsSender, SMS_SENDER, TwilioSmsSender } from './sms-sender';
import { OtpService } from './otp.service';
import { VerificationController } from './verification.controller';

@Module({
  controllers: [VerificationController],
  providers: [
    OtpService,
    LogSmsSender,
    TwilioSmsSender,
    {
      provide: SMS_SENDER,
      inject: [ConfigService, LogSmsSender, TwilioSmsSender],
      useFactory: (config: ConfigService, log: LogSmsSender, twilio: TwilioSmsSender) =>
        config.get<string>('sms.provider') === 'twilio' ? twilio : log
    }
  ],
  exports: [OtpService]
})
export class VerificationModule {}

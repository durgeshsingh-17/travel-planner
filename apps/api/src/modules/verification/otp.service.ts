import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';

import { PrismaService } from '../../database/prisma.service';
import { SMS_SENDER, SmsSender } from './sms-sender';

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;
const MAX_ATTEMPTS = 5;

/** Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX). */
export function toE164India(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.slice(-10);
  return `+91${national}`;
}

@Injectable()
export class OtpService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    config: ConfigService
  ) {
    this.secret = config.get<string>('auth.tokenSecret') ?? '';
  }

  /** Sends a 6-digit code. Limits: one per minute, three per 15 minutes per number. */
  async requestCode(rawPhone: string, ip?: string) {
    const phone = toE164India(rawPhone);
    const now = Date.now();
    const recent = await this.prisma.otpChallenge.findMany({
      where: { phone, purpose: 'VERIFY_PHONE', createdAt: { gte: new Date(now - SEND_WINDOW_MS) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - recent[0].createdAt.getTime())) / 1000);
      throw new HttpException(`Please wait ${wait} seconds before requesting another code.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (recent.length >= MAX_SENDS_PER_WINDOW) {
      throw new HttpException('Too many codes requested for this number. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = this.generateCode();
    await this.prisma.otpChallenge.create({
      data: {
        phone,
        purpose: 'VERIFY_PHONE',
        codeHash: this.hash(phone, code),
        expiresAt: new Date(now + CODE_TTL_MS),
        ip: ip?.slice(0, 64)
      }
    });
    await this.sms.send(phone, `${code} is your Travel Platform verification code. It expires in 5 minutes.`);

    return { phone, expiresInSeconds: CODE_TTL_MS / 1000, resendAfterSeconds: RESEND_COOLDOWN_MS / 1000 };
  }

  /** Checks the latest code for the number and marks the user's phone as verified. */
  async confirmCode(userId: string, rawPhone: string, code: string) {
    const phone = toE164India(rawPhone);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose: 'VERIFY_PHONE', consumedAt: null },
      orderBy: { createdAt: 'desc' }
    });

    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This code has expired. Request a new one.');
    }

    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many wrong attempts. Request a new code.');
    }

    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(this.hash(phone, code), 'hex');

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException(
        `That code is not right. ${MAX_ATTEMPTS - challenge.attempts - 1} attempt(s) left.`
      );
    }

    const verifiedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: verifiedAt } }),
      this.prisma.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: verifiedAt } })
    ]);

    return { phone, phoneVerifiedAt: verifiedAt.toISOString() };
  }

  private generateCode(): string {
    const fixed = process.env.OTP_FIXED_CODE;

    // Deterministic codes are for automated tests only and never honoured in production.
    if (fixed && /^\d{6}$/.test(fixed) && process.env.NODE_ENV !== 'production') {
      return fixed;
    }

    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private hash(phone: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${phone}:${code}`).digest('hex');
  }
}

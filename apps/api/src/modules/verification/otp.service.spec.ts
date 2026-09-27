import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OtpService, toE164India } from './otp.service';

interface Challenge {
  id: string;
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

function setup() {
  const challenges: Challenge[] = [];
  const sent: Array<{ to: string; body: string }> = [];
  const prisma = {
    otpChallenge: {
      findMany: vi.fn(async ({ where }: { where: { phone: string; createdAt: { gte: Date } } }) =>
        challenges
          .filter((c) => c.phone === where.phone && c.createdAt >= where.createdAt.gte)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      ),
      findFirst: vi.fn(async ({ where }: { where: { phone: string } }) => {
        // Return a copy, as Prisma does, so later updates do not change it.
        const found = challenges.filter((c) => c.phone === where.phone && !c.consumedAt).at(-1);
        return found ? { ...found } : null;
      }),
      create: vi.fn(async ({ data }: { data: Omit<Challenge, 'id' | 'attempts' | 'consumedAt' | 'createdAt'> }) => {
        const challenge = { id: `c${challenges.length}`, attempts: 0, consumedAt: null, createdAt: new Date(), ...data };
        challenges.push(challenge);
        return challenge;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { attempts?: { increment: number }; consumedAt?: Date } }) => {
        const challenge = challenges.find((c) => c.id === where.id)!;
        if (data.attempts) challenge.attempts += data.attempts.increment;
        if (data.consumedAt) challenge.consumedAt = data.consumedAt;
        return challenge;
      })
    },
    user: { update: vi.fn() },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations))
  };
  const service = new OtpService(
    prisma as never,
    { send: async (to: string, body: string) => void sent.push({ to, body }) },
    new ConfigService({ auth: { tokenSecret: 'x'.repeat(40) } })
  );
  return { service, challenges, sent, prisma };
}

describe('OtpService', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.OTP_FIXED_CODE;
  });

  it('normalises Indian numbers to E.164', () => {
    expect(toE164India('98765 43210')).toBe('+919876543210');
    expect(toE164India('+91-9876543210')).toBe('+919876543210');
    expect(toE164India('919876543210')).toBe('+919876543210');
  });

  it('texts a 6-digit code and stores only a hash of it', async () => {
    const { service, challenges, sent } = setup();

    await service.requestCode('9876543210');

    const code = sent[0].body.slice(0, 6);
    expect(code).toMatch(/^\d{6}$/);
    expect(sent[0].to).toBe('+919876543210');
    expect(challenges[0].codeHash).not.toContain(code);
  });

  it('enforces a resend cooldown and a per-window limit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    const { service } = setup();

    await service.requestCode('9876543210');
    await expect(service.requestCode('9876543210')).rejects.toThrow(/wait/);
    vi.setSystemTime(new Date('2026-10-01T10:01:01Z'));
    await service.requestCode('9876543210');
    vi.setSystemTime(new Date('2026-10-01T10:02:02Z'));
    await service.requestCode('9876543210');
    vi.setSystemTime(new Date('2026-10-01T10:03:03Z'));
    await expect(service.requestCode('9876543210')).rejects.toThrow(/Too many codes/);
  });

  it('verifies the right code once, counts wrong attempts, and rejects expired codes', async () => {
    process.env.OTP_FIXED_CODE = '424242';
    const { service, prisma } = setup();
    await service.requestCode('9876543210');

    await expect(service.confirmCode('user-1', '9876543210', '111111')).rejects.toThrow(/4 attempt/);
    await expect(service.confirmCode('user-1', '9876543210', '424242')).resolves.toMatchObject({ phone: '+919876543210' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: expect.objectContaining({ phone: '+919876543210' }) })
    );
    await expect(service.confirmCode('user-1', '9876543210', '424242')).rejects.toThrow(/expired/);
  });

  it('locks a code after five wrong attempts', async () => {
    const { service, challenges } = setup();
    await service.requestCode('9876543210');
    challenges[0].attempts = 5;

    await expect(service.confirmCode('user-1', '9876543210', '000000')).rejects.toThrow(/Too many wrong attempts/);
  });

  it('never honours the fixed test code in production', async () => {
    process.env.OTP_FIXED_CODE = '424242';
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const { service, sent } = setup();

    try {
      await service.requestCode('9876543210');
      expect(sent[0].body.startsWith('424242')).toBe(false);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

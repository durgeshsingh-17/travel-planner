import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from 'crypto';
import { promisify } from 'util';

import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';

const scrypt = promisify(scryptCallback);

const MIN_SECRET_LENGTH = 32;
const DEFAULT_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const TOKEN_HEADER = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'JWT' })
).toString('base64url');

export interface AuthTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly tokenSecret: string;
  private readonly tokenTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService
  ) {
    const secret = config.get<string>('auth.tokenSecret');

    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `AUTH_TOKEN_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters. ` +
          'Generate one with: openssl rand -base64 48'
      );
    }

    this.tokenSecret = secret;
    this.tokenTtlSeconds =
      config.get<number>('auth.tokenTtlSeconds') || DEFAULT_TOKEN_TTL_SECONDS;
  }

  status() {
    return {
      enabled: true,
      provider: 'local-email-password',
      message: 'Local MVP authentication is enabled'
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        phone: dto.phone,
        passwordHash: await this.hashPassword(dto.password)
      }
    });

    return this.authResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });

    if (!user?.passwordHash || !(await this.verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.authResponse(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    return this.serializeUser(user);
  }

  verifyToken(authorization?: string): AuthTokenPayload {
    if (!authorization) {
      throw new UnauthorizedException('Missing auth token');
    }

    const token = authorization.replace(/^Bearer\s+/i, '');
    const [header, payload, signature] = token.split('.');

    if (
      header !== TOKEN_HEADER ||
      !payload ||
      !signature ||
      !this.signatureMatches(`${header}.${payload}`, signature)
    ) {
      throw new UnauthorizedException('Invalid auth token');
    }

    const claims = this.parseClaims(payload);

    if (claims.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Session has expired. Please sign in again.');
    }

    return claims;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    const [salt, storedHash] = passwordHash.split(':');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    const storedBuffer = Buffer.from(storedHash, 'hex');

    return (
      storedBuffer.length === derivedKey.length &&
      timingSafeEqual(storedBuffer, derivedKey)
    );
  }

  private authResponse(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  }) {
    return {
      token: this.signToken(user.id),
      user: this.serializeUser(user)
    };
  }

  private serializeUser(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl
    };
  }

  private signToken(userId: string): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        iat: issuedAt,
        exp: issuedAt + this.tokenTtlSeconds
      } satisfies AuthTokenPayload)
    ).toString('base64url');
    const signingInput = `${TOKEN_HEADER}.${payload}`;

    return `${signingInput}.${this.sign(signingInput)}`;
  }

  private parseClaims(payload: string): AuthTokenPayload {
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as
        Partial<AuthTokenPayload>;

      if (
        typeof claims.sub === 'string' &&
        typeof claims.iat === 'number' &&
        typeof claims.exp === 'number'
      ) {
        return claims as AuthTokenPayload;
      }
    } catch {
      // Fall through to the generic invalid-token error.
    }

    throw new UnauthorizedException('Invalid auth token');
  }

  private signatureMatches(signingInput: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(signingInput));
    const actual = Buffer.from(signature);

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private sign(signingInput: string): string {
    return createHmac('sha256', this.tokenSecret).update(signingInput).digest('base64url');
  }
}

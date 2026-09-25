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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

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

  async me(token?: string) {
    const payload = this.verifyToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    return this.serializeUser(user);
  }

  resolveUserIdFromAuthorization(authorization?: string): string {
    return this.verifyToken(authorization).sub;
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
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        iat: Date.now()
      })
    ).toString('base64url');
    return `${payload}.${this.signPayload(payload)}`;
  }

  private verifyToken(token?: string): { sub: string } {
    if (!token) {
      throw new UnauthorizedException('Missing auth token');
    }

    const normalizedToken = token.replace(/^Bearer\s+/i, '');
    const [payload, signature] = normalizedToken.split('.');

    if (!payload || !signature || this.signPayload(payload) !== signature) {
      throw new UnauthorizedException('Invalid auth token');
    }

    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub: string;
    };
  }

  private signPayload(payload: string): string {
    return createHmac(
      'sha256',
      this.config.get<string>('AUTH_TOKEN_SECRET', 'dev-auth-secret')
    )
      .update(payload)
      .digest('base64url');
  }
}

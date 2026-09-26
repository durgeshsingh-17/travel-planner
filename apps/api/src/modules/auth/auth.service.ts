import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual
} from 'crypto';
import { promisify } from 'util';

import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';

const scrypt = promisify(scryptCallback);

const MIN_SECRET_LENGTH = 32;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
/**
 * Two tabs can refresh with the same token at nearly the same moment. Within
 * this window a just-rotated token is treated as a race, not as theft.
 */
const REFRESH_REUSE_GRACE_MS = 20_000;
const TOKEN_HEADER = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'JWT' })
).toString('base64url');

export interface AuthTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

export interface ClientContext {
  userAgent?: string;
  ip?: string;
}

export interface IssuedSession {
  token: string;
  expiresAt: string;
  refreshToken: string;
  refreshTokenId: string;
  refreshTokenExpiresAt: Date;
  user: SerializedUser;
}

type SerializableUser = Pick<User, 'id' | 'name' | 'email' | 'phone' | 'avatarUrl' | 'role'>;
export type SerializedUser = SerializableUser;

@Injectable()
export class AuthService {
  private readonly tokenSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlMs: number;

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
    this.accessTokenTtlSeconds =
      config.get<number>('auth.accessTokenTtlSeconds') || DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
    this.refreshTokenTtlMs =
      (config.get<number>('auth.refreshTokenTtlDays') || DEFAULT_REFRESH_TOKEN_TTL_DAYS) *
      24 *
      60 *
      60 *
      1000;
  }

  status() {
    return {
      enabled: true,
      provider: 'local-email-password',
      message: 'Local MVP authentication is enabled'
    };
  }

  async register(dto: RegisterDto, client: ClientContext = {}): Promise<IssuedSession> {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone,
        passwordHash: await this.hashPassword(dto.password)
      }
    });

    return this.issueSession(user, client);
  }

  async login(dto: LoginDto, client: ClientContext = {}): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() }
    });

    if (!user?.passwordHash || !(await this.verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user, client);
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

  /** Rotates a refresh token: the presented token is retired and a new one issued. */
  async refresh(rawToken: string | undefined, client: ClientContext = {}): Promise<IssuedSession> {
    if (!rawToken) {
      throw new UnauthorizedException('Session has expired. Please sign in again.');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(rawToken) },
      include: { user: true }
    });

    if (!stored) {
      throw new UnauthorizedException('Session has expired. Please sign in again.');
    }

    if (stored.revokedAt) {
      const isRecentRotation =
        stored.replacedById !== null &&
        Date.now() - stored.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;

      if (!isRecentRotation) {
        // A retired token came back: assume it was stolen and end every session in its family.
        await this.revokeFamily(stored.familyId);
        throw new UnauthorizedException('Session has expired. Please sign in again.');
      }

      return this.issueSession(stored.user, client, stored.familyId);
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session has expired. Please sign in again.');
    }

    const session = await this.issueSession(stored.user, client, stored.familyId);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: session.refreshTokenId }
    });

    return session;
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(rawToken) },
      select: { familyId: true }
    });

    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    client: ClientContext = {}
  ): Promise<IssuedSession> {
    const user = await this.assertPassword(userId, currentPassword);

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current one');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.hashPassword(newPassword) }
    });
    // Sign out every other device; the caller gets a fresh session.
    await this.logoutAll(user.id);

    return this.issueSession(updated, client);
  }

  /** Throws unless `password` matches the user's current password. */
  async assertPassword(userId: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user?.passwordHash || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }

    return user;
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

  serializeUser(user: SerializableUser): SerializedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role
    };
  }

  private async issueSession(
    user: SerializableUser,
    client: ClientContext,
    familyId: string = randomUUID()
  ): Promise<IssuedSession> {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenExpiresAt = new Date(Date.now() + this.refreshTokenTtlMs);

    const stored = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        familyId,
        expiresAt: refreshTokenExpiresAt,
        userAgent: client.userAgent?.slice(0, 300),
        ip: client.ip?.slice(0, 64)
      },
      select: { id: true }
    });

    const { token, exp } = this.signToken(user.id);

    return {
      token,
      expiresAt: new Date(exp * 1000).toISOString(),
      refreshToken,
      refreshTokenId: stored.id,
      refreshTokenExpiresAt,
      user: this.serializeUser(user)
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  private hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
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

  private signToken(userId: string): { token: string; exp: number } {
    const issuedAt = Math.floor(Date.now() / 1000);
    const exp = issuedAt + this.accessTokenTtlSeconds;
    const payload = Buffer.from(
      JSON.stringify({ sub: userId, iat: issuedAt, exp } satisfies AuthTokenPayload)
    ).toString('base64url');
    const signingInput = `${TOKEN_HEADER}.${payload}`;

    return { token: `${signingInput}.${this.sign(signingInput)}`, exp };
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

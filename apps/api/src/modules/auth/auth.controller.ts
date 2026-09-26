import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { AUTH_THROTTLE } from './auth.throttle';
import { AuthService } from './auth.service';
import { CurrentUserId } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { RegisterDto } from './dto/register.dto';
import {
  clearRefreshCookie,
  clientContext,
  readRefreshCookie,
  sessionResponse,
  setRefreshCookie
} from './session-cookie';

@ApiTags('auth')
@Controller({
  path: 'auth',
  version: '1'
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('status')
  status() {
    return this.authService.status();
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const session = await this.authService.register(dto, clientContext(request));
    setRefreshCookie(response, session);
    return sessionResponse(session);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const session = await this.authService.login(dto, clientContext(request));
    setRefreshCookie(response, session);
    return sessionResponse(session);
  }

  /** Exchanges the httpOnly refresh cookie for a new access token (and rotates the cookie). */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const session = await this.authService.refresh(
        readRefreshCookie(request),
        clientContext(request)
      );
      setRefreshCookie(response, session);
      return sessionResponse(session);
    } catch (error) {
      clearRefreshCookie(response);
      throw error;
    }
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(readRefreshCookie(request));
    clearRefreshCookie(response);
    return { signedOut: true };
  }

  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(
    @CurrentUserId() userId: string,
    @Res({ passthrough: true }) response: Response
  ) {
    await this.authService.logoutAll(userId);
    clearRefreshCookie(response);
    return { signedOut: true };
  }

  @Get('me')
  me(@CurrentUserId() userId: string) {
    return this.authService.me(userId);
  }
}

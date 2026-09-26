import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { AUTH_THROTTLE } from '../auth/auth.throttle';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUserId } from '../auth/current-user.decorator';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { MeService } from './me.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  clearRefreshCookie,
  clientContext,
  sessionResponse,
  setRefreshCookie
} from '../auth/session-cookie';

@ApiTags('me')
@Controller({
  path: 'me',
  version: '1'
})
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  get(@CurrentUserId() userId: string) {
    return this.meService.get(userId);
  }

  @Patch()
  update(@CurrentUserId() userId: string, @Body() dto: UpdateMeDto) {
    return this.meService.update(userId, dto);
  }

  @Patch('profile')
  updateProfile(@CurrentUserId() userId: string, @Body() dto: UpdateProfileDto) {
    return this.meService.updateProfile(userId, dto);
  }

  /** Signs out every other device and returns a fresh session for this one. */
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('password')
  async changePassword(
    @CurrentUserId() userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const session = await this.meService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      clientContext(request)
    );
    setRefreshCookie(response, session);
    return sessionResponse(session);
  }

  @Throttle(AUTH_THROTTLE)
  @Delete()
  async delete(
    @CurrentUserId() userId: string,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.meService.delete(userId, dto.password);
    clearRefreshCookie(response);
    return result;
  }
}

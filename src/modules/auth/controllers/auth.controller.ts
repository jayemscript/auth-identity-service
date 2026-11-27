import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { LoginService } from '../services/login.service';
import { VerifyTokenService } from '../services/verify-token.service';
import { RefreshSessionService } from '../services/refresh-session.service';
import { UserSessionGuard } from '../guards/user-session.guard';
import { RevokeSessionsService } from '../services/revoke-sessions.service';
import {
  LoginRequestDto,
  RefreshTokenRequestDto,
  VerifyTokenRequestDto,
} from '../dtos';
import { successResponse } from '../../../common';
import { RequireAppScopes } from '../../../common/security';

@Controller('v1/auth')
@UseGuards(ApiKeyGuard)
export class AuthController {
  constructor(
    private readonly login: LoginService,
    private readonly verifyToken: VerifyTokenService,
    private readonly refreshSession: RefreshSessionService,
    private readonly revokeSessions: RevokeSessionsService,
  ) {}

  @Post('login')
  @RequireAppScopes('auth:login')
  async execute(@Body() body: LoginRequestDto, @Req() request: Request) {
    const appId = request.header('x-app-id');
    if (!appId)
      throw new BadRequestException(
        'Choose an app by including its slug in the X-App-Id header.',
      );
    const { userName, ...tokens } = await this.login.execute({
      ...body,
      appId,
      ipAddress: request.ip,
    });
    return successResponse(`Welcome, ${userName}! You are signed in.`, tokens);
  }

  @Post('verify')
  @RequireAppScopes('tokens:verify')
  async verify(@Body() body: VerifyTokenRequestDto, @Req() request: Request) {
    const appSlug = request.header('x-app-id');
    if (!appSlug)
      throw new BadRequestException(
        'Choose an app by including its slug in the X-App-Id header.',
      );
    const result = await this.verifyToken.execute({ ...body, appSlug });
    return successResponse(
      result.active
        ? 'This token is active.'
        : 'This token is no longer active.',
      result,
    );
  }

  @Post('refresh')
  @RequireAppScopes('tokens:refresh')
  async refresh(@Body() body: RefreshTokenRequestDto, @Req() request: Request) {
    const appSlug = request.header('x-app-id');
    if (!appSlug)
      throw new BadRequestException(
        'Choose an app by including its slug in the X-App-Id header.',
      );
    const result = await this.refreshSession.execute(
      body.refreshToken,
      appSlug,
    );
    return successResponse('Your session has been refreshed.', result);
  }

  @Post('logout')
  @RequireAppScopes('sessions:revoke:self')
  @UseGuards(UserSessionGuard)
  async logout(
    @Req()
    request: Request & {
      identity?: { userId: string; sessionId: string; appId: string };
    },
  ) {
    const result = await this.revokeSessions.execute({
      userId: request.identity!.userId,
      appSlug: request.identity!.appId,
      sessionId: request.identity!.sessionId,
    });
    return successResponse('You have been signed out.', result);
  }
}

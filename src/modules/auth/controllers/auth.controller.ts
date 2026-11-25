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
  execute(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
  ) {
    const appId = request.header('x-app-id');
    if (!appId) throw new BadRequestException('X-App-Id is required');
    return this.login.execute({ ...body, appId });
  }

  @Post('verify')
  verify(
    @Body() body: VerifyTokenRequestDto,
    @Req() request: Request,
  ) {
    const appSlug = request.header('x-app-id');
    if (!appSlug) throw new BadRequestException('X-App-Id is required');
    return this.verifyToken.execute({ ...body, appSlug });
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenRequestDto, @Req() request: Request) {
    const appSlug = request.header('x-app-id');
    if (!appSlug) throw new BadRequestException('X-App-Id is required');
    return this.refreshSession.execute(body.refreshToken, appSlug);
  }

  @Post('logout')
  @UseGuards(UserSessionGuard)
  logout(
    @Req()
    request: Request & {
      identity?: { userId: string; sessionId: string; appId: string };
    },
  ) {
    return this.revokeSessions.execute({
      userId: request.identity!.userId,
      appSlug: request.identity!.appId,
      sessionId: request.identity!.sessionId,
    });
  }
}

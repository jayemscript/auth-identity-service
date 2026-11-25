import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserSessionGuard } from '../guards/user-session.guard';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ListSessionsService } from '../services/list-sessions.service';
import { RevokeSessionsService } from '../services/revoke-sessions.service';
import { ListSessionsQueryDto } from '../dtos';
import { successResponse } from '../../../common';

type UserRequest = Request & {
  identity: { userId: string; appId: string; sessionId: string };
};

@Controller('v1/sessions')
@UseGuards(ApiKeyGuard, UserSessionGuard)
export class SessionsController {
  constructor(
    private readonly list: ListSessionsService,
    private readonly revoke: RevokeSessionsService,
  ) {}

  @Get()
  async listOwned(
    @Req() request: UserRequest,
    @Query() query: ListSessionsQueryDto,
  ) {
    const result = await this.list.execute({
      userId: request.identity.userId,
      appSlug: request.identity.appId,
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    });
    return successResponse('Here are your sessions.', result);
  }

  @Get(':sessionId')
  async getOwned(
    @Req() request: UserRequest,
    @Param('sessionId') sessionId: string,
  ) {
    const result = await this.list.execute({
      userId: request.identity.userId,
      appSlug: request.identity.appId,
      limit: 1,
      offset: 0,
      sessionId,
      status: 'all',
    });
    if (!result[0])
      throw new NotFoundException(
        'We could not find this session in your account.',
      );
    return successResponse('Here are the session details.', result[0]);
  }

  @Delete()
  async revokeAll(@Req() request: UserRequest) {
    const result = await this.revoke.execute({
      userId: request.identity.userId,
      appSlug: request.identity.appId,
    });
    return successResponse(
      result.revoked
        ? 'You have been signed out from all sessions in this app.'
        : 'You have no active sessions in this app.',
      result,
    );
  }

  @Delete(':sessionId')
  async revokeOne(
    @Req() request: UserRequest,
    @Param('sessionId') sessionId: string,
  ) {
    const result = await this.revoke.execute({
      userId: request.identity.userId,
      appSlug: request.identity.appId,
      sessionId,
    });
    return successResponse(
      result.revoked
        ? 'The session has been ended.'
        : 'No active session was found.',
      result,
    );
  }
}

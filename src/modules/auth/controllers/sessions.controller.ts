import {
  Controller,
  Delete,
  Get,
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
  listOwned(
    @Req() request: UserRequest,
    @Query() query: ListSessionsQueryDto,
  ) {
    return this.list.execute({
      userId: request.identity.userId,
      appSlug: request.identity.appId,
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    });
  }

  @Get(':sessionId')
  getOwned(@Req() request: UserRequest, @Param('sessionId') sessionId: string) {
    return this.list.execute({
      userId: request.identity.userId,
      appSlug: request.identity.appId,
      limit: 1,
      offset: 0,
      sessionId,
      status: 'all',
    });
  }

  @Delete()
  revokeAll(@Req() request: UserRequest) {
    return this.revoke.execute({
      userId: request.identity.userId,
      appSlug: request.identity.appId,
    });
  }

  @Delete(':sessionId')
  revokeOne(
    @Req() request: UserRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.revoke.execute({
      userId: request.identity.userId,
      appSlug: request.identity.appId,
      sessionId,
    });
  }
}

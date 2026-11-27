import { Controller, Delete, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SuperAdminGuard } from '../guards/superadmin.guard';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { AdminSessionsService } from '../services/admin-sessions.service';
import { RequireAppScopes } from '../../../common/security';
import { successResponse } from '../../../common';

@Controller('v1/admin/apps/:appId/users/:userId/sessions')
@UseGuards(ApiKeyGuard, SuperAdminGuard)
export class AdminSessionsController {
  constructor(private readonly sessions: AdminSessionsService) {}

  @Get()
  @RequireAppScopes('sessions:read')
  async list(@Param('appId') appId: string, @Param('userId') userId: string) {
    const result = await this.sessions.execute({ appId, userId });
    return successResponse('Here are the user’s sessions.', result);
  }
  @Get(':sessionId')
  @RequireAppScopes('sessions:read')
  async get(
    @Param('appId') appId: string,
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const result = await this.sessions.execute({ appId, userId, sessionId });
    return successResponse('Here are the session details.', result);
  }
  @Delete(':sessionId')
  @RequireAppScopes('sessions:revoke')
  async revoke(
    @Req() request: Request & { identity?: { userId: string } },
    @Param('appId') appId: string,
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const result = await this.sessions.execute({
      appId,
      userId,
      sessionId,
      revoke: true,
      actorId: request.identity?.userId,
    });
    const revoked = Boolean((result as { revoked?: boolean }).revoked);
    return successResponse(
      revoked ? 'The session has been ended.' : 'No active session was found.',
      result,
    );
  }
}

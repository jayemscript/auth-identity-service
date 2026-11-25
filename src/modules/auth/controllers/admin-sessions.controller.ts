import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../guards/superadmin.guard';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { AdminSessionsService } from '../services/admin-sessions.service';
import { successResponse } from '../../../common';

@Controller('v1/admin/apps/:appId/users/:userId/sessions')
@UseGuards(ApiKeyGuard, SuperAdminGuard)
export class AdminSessionsController {
  constructor(private readonly sessions: AdminSessionsService) {}

  @Get()
  async list(@Param('appId') appId: string, @Param('userId') userId: string) {
    const result = await this.sessions.execute({ appId, userId });
    return successResponse('Here are the user’s sessions.', result);
  }
  @Get(':sessionId')
  async get(
    @Param('appId') appId: string,
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const result = await this.sessions.execute({ appId, userId, sessionId });
    return successResponse('Here are the session details.', result);
  }
  @Delete(':sessionId')
  async revoke(
    @Param('appId') appId: string,
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const result = await this.sessions.execute({
      appId,
      userId,
      sessionId,
      revoke: true,
    });
    const revoked = Boolean((result as { revoked?: boolean }).revoked);
    return successResponse(
      revoked ? 'The session has been ended.' : 'No active session was found.',
      result,
    );
  }
}

import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../guards/superadmin.guard';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { AdminSessionsService } from '../services/admin-sessions.service';

@Controller('v1/admin/apps/:appId/users/:userId/sessions')
@UseGuards(ApiKeyGuard, SuperAdminGuard)
export class AdminSessionsController {
  constructor(private readonly sessions: AdminSessionsService) {}

  @Get()
  list(@Param('appId') appId: string, @Param('userId') userId: string) { return this.sessions.execute({ appId, userId }); }
  @Get(':sessionId')
  get(@Param('appId') appId: string, @Param('userId') userId: string, @Param('sessionId') sessionId: string) { return this.sessions.execute({ appId, userId, sessionId }); }
  @Delete(':sessionId')
  revoke(@Param('appId') appId: string, @Param('userId') userId: string, @Param('sessionId') sessionId: string) { return this.sessions.execute({ appId, userId, sessionId, revoke: true }); }
}

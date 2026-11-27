import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { SuperAdminGuard } from '../../auth/guards/superadmin.guard';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ManageAccessService } from '../services/manage-access.service';
import { UpdateUserConfigDto } from '../dtos';
import { successResponse } from '../../../common';
import { RequireAppScopes } from '../../../common/security';

type AdminRequest = Request & { identity?: { userId: string; sessionId: string; appId: string } };

@Controller('v1/admin')
@UseGuards(ApiKeyGuard, SuperAdminGuard)
export class AdminAccessController {
  constructor(private readonly access: ManageAccessService) {}

  @Put('apps/:appId/users/:userId/access')
  @RequireAppScopes('users:access:write')
  async grant(@Param('appId') appId: string, @Param('userId') userId: string, @Req() request: AdminRequest) {
    const result: unknown = await this.access.execute({
      action: 'grant',
      appId,
      userId,
      actorId: request.identity?.userId,
    });
    return successResponse('App access was granted to the user.', result);
  }
  @Delete('apps/:appId/users/:userId/access')
  @RequireAppScopes('users:access:write')
  async revoke(@Param('appId') appId: string, @Param('userId') userId: string, @Req() request: AdminRequest) {
    const result: unknown = await this.access.execute({
      action: 'revoke',
      appId,
      userId,
      actorId: request.identity?.userId,
    });
    const revoked = Boolean((result as { revoked?: boolean }).revoked);
    return successResponse(
      revoked
        ? 'The user’s app access was removed.'
        : 'The user did not have active access to this app.',
      result,
    );
  }
  @Patch('users/:userId/config')
  @RequireAppScopes('users:config:write')
  async updateConfig(
    @Param('userId') userId: string,
    @Body() body: UpdateUserConfigDto,
    @Req() request: AdminRequest,
  ) {
    const result: unknown = await this.access.execute({
      action: 'config',
      userId,
      body,
      actorId: request.identity?.userId,
    });
    return successResponse('The user settings were updated.', result);
  }
}

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../../auth/guards/superadmin.guard';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ReadAppsService } from '../services/read-apps.service';
import { successResponse } from '../../../common';
import { RequireAppScopes } from '../../../common/security';

@Controller('v1/admin/apps')
@UseGuards(ApiKeyGuard, SuperAdminGuard)
export class AdminAppsController {
  constructor(private readonly apps: ReadAppsService) {}

  @Get()
  @RequireAppScopes('apps:read')
  async list() {
    const result = await this.apps.execute();
    return successResponse('Here are the registered apps.', result);
  }

  @Get(':appId')
  @RequireAppScopes('apps:read')
  async get(@Param('appId') appId: string) {
    const result = await this.apps.execute(appId);
    return successResponse('The app details are ready.', result);
  }
}

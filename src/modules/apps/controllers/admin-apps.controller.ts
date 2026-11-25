import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminGuard } from '../../auth/guards/superadmin.guard';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ManageAppsService } from '../services/manage-apps.service';
import { CreateAppDto, UpdateAppDto } from '../dtos';
import { successResponse } from '../../../common';

@Controller('v1/admin/apps')
@UseGuards(ApiKeyGuard, SuperAdminGuard)
export class AdminAppsController {
  constructor(private readonly apps: ManageAppsService) {}

  @Post()
  async create(@Body() body: CreateAppDto) {
    const result: unknown = await this.apps.execute({
      action: 'create',
      body: { ...body },
    });
    return successResponse('The app was created successfully.', result);
  }
  @Get()
  async list() {
    const result: unknown = await this.apps.execute({ action: 'list' });
    return successResponse('Here are the registered apps.', result);
  }
  @Get(':appId')
  async get(@Param('appId') appId: string) {
    const result: unknown = await this.apps.execute({ action: 'get', appId });
    return successResponse('The app details are ready.', result);
  }
  @Patch(':appId')
  async update(@Param('appId') appId: string, @Body() body: UpdateAppDto) {
    const result: unknown = await this.apps.execute({
      action: 'update',
      appId,
      body: { ...body },
    });
    return successResponse('The app was updated successfully.', result);
  }
}

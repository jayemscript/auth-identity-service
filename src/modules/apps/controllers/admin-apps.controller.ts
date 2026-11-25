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

@Controller('v1/admin/apps')
@UseGuards(ApiKeyGuard, SuperAdminGuard)
export class AdminAppsController {
  constructor(private readonly apps: ManageAppsService) {}

  @Post()
  create(@Body() body: CreateAppDto) {
    return this.apps.execute({ action: 'create', body: { ...body } });
  }
  @Get()
  list() {
    return this.apps.execute({ action: 'list' });
  }
  @Get(':appId')
  get(@Param('appId') appId: string) {
    return this.apps.execute({ action: 'get', appId });
  }
  @Patch(':appId')
  update(@Param('appId') appId: string, @Body() body: UpdateAppDto) {
    return this.apps.execute({ action: 'update', appId, body: { ...body } });
  }
}

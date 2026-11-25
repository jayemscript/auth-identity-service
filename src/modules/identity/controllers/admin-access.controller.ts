import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminGuard } from '../../auth/guards/superadmin.guard';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ManageAccessService } from '../services/manage-access.service';
import { UpdateUserConfigDto } from '../dtos';

@Controller('v1/admin')
@UseGuards(ApiKeyGuard, SuperAdminGuard)
export class AdminAccessController {
  constructor(private readonly access: ManageAccessService) {}

  @Put('apps/:appId/users/:userId/access')
  grant(@Param('appId') appId: string, @Param('userId') userId: string) {
    return this.access.execute({ action: 'grant', appId, userId });
  }
  @Delete('apps/:appId/users/:userId/access')
  revoke(@Param('appId') appId: string, @Param('userId') userId: string) {
    return this.access.execute({ action: 'revoke', appId, userId });
  }
  @Patch('users/:userId/config')
  updateConfig(
    @Param('userId') userId: string,
    @Body() body: UpdateUserConfigDto,
  ) {
    return this.access.execute({ action: 'config', userId, body });
  }
}

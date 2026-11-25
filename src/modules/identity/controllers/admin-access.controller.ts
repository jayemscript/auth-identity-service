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
import { successResponse } from '../../../common';

@Controller('v1/admin')
@UseGuards(ApiKeyGuard, SuperAdminGuard)
export class AdminAccessController {
  constructor(private readonly access: ManageAccessService) {}

  @Put('apps/:appId/users/:userId/access')
  async grant(@Param('appId') appId: string, @Param('userId') userId: string) {
    const result: unknown = await this.access.execute({
      action: 'grant',
      appId,
      userId,
    });
    return successResponse('App access was granted to the user.', result);
  }
  @Delete('apps/:appId/users/:userId/access')
  async revoke(@Param('appId') appId: string, @Param('userId') userId: string) {
    const result: unknown = await this.access.execute({
      action: 'revoke',
      appId,
      userId,
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
  async updateConfig(
    @Param('userId') userId: string,
    @Body() body: UpdateUserConfigDto,
  ) {
    const result: unknown = await this.access.execute({
      action: 'config',
      userId,
      body,
    });
    return successResponse('The user settings were updated.', result);
  }
}

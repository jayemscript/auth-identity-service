import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { CheckAppAccessService } from '../services/check-app-access.service';
import { AppAccessCheckDto } from '../dtos';
import { successResponse } from '../../../common';
import { RequireAppScopes } from '../../../common/security';

@Controller('v1/app-access')
@UseGuards(ApiKeyGuard)
export class AppAccessController {
  constructor(private readonly checkAccess: CheckAppAccessService) {}

  @Post('check')
  @RequireAppScopes('app-access:check')
  async check(@Body() body: AppAccessCheckDto, @Req() request: Request) {
    const result = await this.checkAccess.execute(
      body.userId,
      request.header('x-app-id') ?? '',
    );
    return successResponse(
      result.allowed
        ? 'This user can access the app.'
        : 'This user does not currently have access to the app.',
      result,
    );
  }
}

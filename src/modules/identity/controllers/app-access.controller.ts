import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { CheckAppAccessService } from '../services/check-app-access.service';
import { AppAccessCheckDto } from '../dtos';

@Controller('v1/app-access')
@UseGuards(ApiKeyGuard)
export class AppAccessController {
  constructor(private readonly checkAccess: CheckAppAccessService) {}

  @Post('check')
  check(@Body() body: AppAccessCheckDto, @Req() request: Request) {
    return this.checkAccess.execute(
      body.userId,
      request.header('x-app-id') ?? '',
    );
  }
}

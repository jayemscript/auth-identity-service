import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { RegisterUserService } from '../services/register-user.service';
import { UserSessionGuard } from '../../auth/guards/user-session.guard';
import { RegisterUserDto } from '../dtos';
import { successResponse } from '../../../common';
import { RequireAppScopes } from '../../../common/security';

@Controller('v1/registration')
@UseGuards(ApiKeyGuard)
export class RegistrationController {
  constructor(private readonly registerUser: RegisterUserService) {}

  @Post('public')
  @RequireAppScopes('users:register')
  async registerPublic(@Body() body: RegisterUserDto, @Req() request: Request) {
    const result = await this.registerUser.execute({
      ...body,
      source: 'public_registration',
      appSlug: request.header('x-app-id') ?? '',
      ipAddress: request.ip,
    });
    return successResponse(
      'Your account was created. You can now sign in to this app.',
      result,
    );
  }

  @Post('internal')
  @RequireAppScopes('users:register')
  @UseGuards(UserSessionGuard)
  async registerInternal(
    @Body() body: RegisterUserDto,
    @Req() request: Request & { identity?: { userId: string; appId: string } },
  ) {
    const result = await this.registerUser.execute({
      ...body,
      source: 'operator',
      actorId: request.identity?.userId,
      appSlug: request.identity?.appId ?? '',
      ipAddress: request.ip,
    });
    return successResponse('The account was created successfully.', result);
  }
}

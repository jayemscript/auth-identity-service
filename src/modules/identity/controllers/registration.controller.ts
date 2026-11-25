import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { RegisterUserService } from '../services/register-user.service';
import { UserSessionGuard } from '../../auth/guards/user-session.guard';
import { RegisterUserDto } from '../dtos';

@Controller('v1/registration')
@UseGuards(ApiKeyGuard)
export class RegistrationController {
  constructor(private readonly registerUser: RegisterUserService) {}

  @Post('public')
  registerPublic(
    @Body() body: RegisterUserDto,
    @Req() request: Request,
  ) {
    return this.registerUser.execute({
      ...body,
      source: 'public_registration',
      appSlug: request.header('x-app-id') ?? '',
    });
  }

  @Post('internal')
  @UseGuards(UserSessionGuard)
  registerInternal(
    @Body() body: RegisterUserDto,
    @Req() request: Request & { identity?: { userId: string; appId: string } },
  ) {
    return this.registerUser.execute({
      ...body,
      source: 'operator',
      actorId: request.identity?.userId,
      appSlug: request.identity?.appId ?? '',
    });
  }
}

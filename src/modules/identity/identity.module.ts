import { Module } from '@nestjs/common';
import { RegistrationController } from './controllers/registration.controller';
import { RegisterUserService } from './services/register-user.service';
import { CheckAppAccessService } from './services/check-app-access.service';
import { AppAccessController } from './controllers/app-access.controller';
import { JwtModule } from '@nestjs/jwt';
import { UserSessionGuard } from '../auth/guards/user-session.guard';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AdminAccessController } from './controllers/admin-access.controller';
import { ManageAccessService } from './services/manage-access.service';
import { UserAccessRepository } from './repositories/user-access.repository';
import { PolicyModule } from '../policies';
import { SecurityModule } from '../security';
import { EventsModule } from '../events/events.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [JwtModule.register({}), PolicyModule, SecurityModule, EventsModule, AuthModule],
  controllers: [
    RegistrationController,
    AppAccessController,
    AdminAccessController,
  ],
  providers: [
    RegisterUserService,
    CheckAppAccessService,
    UserSessionGuard,
    SuperAdminGuard,
    ApiKeyGuard,
    ManageAccessService,
    UserAccessRepository,
  ],
})
export class IdentityModule {}

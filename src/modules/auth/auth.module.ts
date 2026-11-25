import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { LoginService } from './services/login.service';
import { VerifyTokenService } from './services/verify-token.service';
import { RefreshSessionService } from './services/refresh-session.service';
import { ListSessionsService } from './services/list-sessions.service';
import { RevokeSessionsService } from './services/revoke-sessions.service';
import { UserSessionGuard } from './guards/user-session.guard';
import { SessionsController } from './controllers/sessions.controller';
import { AdminSessionsController } from './controllers/admin-sessions.controller';
import { AdminSessionsService } from './services/admin-sessions.service';
import { SuperAdminGuard } from './guards/superadmin.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, SessionsController, AdminSessionsController],
  providers: [
    ApiKeyGuard,
    LoginService,
    VerifyTokenService,
    RefreshSessionService,
    ListSessionsService,
    RevokeSessionsService,
    UserSessionGuard,
    SuperAdminGuard,
    AdminSessionsService,
  ],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AdminAppsController } from './controllers/admin-apps.controller';
import { ManageAppsService } from './services/manage-apps.service';
import { ApplicationRepository } from './repositories/application.repository';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminAppsController],
  providers: [ApiKeyGuard, SuperAdminGuard, ManageAppsService, ApplicationRepository],
})
export class AppsModule {}

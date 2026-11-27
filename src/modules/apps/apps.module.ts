import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AdminAppsController } from './controllers/admin-apps.controller';
import { ReadAppsService } from './services/read-apps.service';
import { ApplicationRepository } from './repositories/application.repository';
import { PolicyModule } from '../policies';

@Module({
  imports: [JwtModule.register({}), PolicyModule],
  controllers: [AdminAppsController],
  providers: [
    ApiKeyGuard,
    SuperAdminGuard,
    ReadAppsService,
    ApplicationRepository,
  ],
})
export class AppsModule {}

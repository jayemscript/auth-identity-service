import { Module } from '@nestjs/common';
import { AuditLogService, LoginAttemptsService, SecurityRulesService, UserDevicesService } from './services';

@Module({ providers: [AuditLogService, SecurityRulesService, LoginAttemptsService, UserDevicesService], exports: [AuditLogService, SecurityRulesService, LoginAttemptsService, UserDevicesService] })
export class SecurityModule {}

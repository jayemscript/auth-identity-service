import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ApiKeyOnlyGuard } from './guards';

@Module({
  controllers: [HealthController],
  providers: [ApiKeyOnlyGuard],
})
export class HealthModule {}

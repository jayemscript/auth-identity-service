import { Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiKeyOnlyGuard } from './guards/api-key-only.guard';

@Controller('health')
@UseGuards(ApiKeyOnlyGuard)
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async execute() {
    try {
      await this.dataSource.query(`SELECT 1`);
      const [seed] = await this.dataSource.query(`SELECT 1 FROM system.bootstrap_runs LIMIT 1`);
      if (!seed) throw new Error('Bootstrap has not completed');
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
  }
}

import {
  Controller,
  Get,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiKeyOnlyGuard } from './guards';
import { successResponse } from '../../common';

@Controller('health')
@UseGuards(ApiKeyOnlyGuard)
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async execute() {
    try {
      await this.dataSource.query('SELECT 1');
      const [bootstrapRun] = await this.dataSource.query(
        'SELECT 1 FROM system.bootstrap_runs LIMIT 1',
      );
      if (!bootstrapRun) throw new Error('Bootstrap has not completed');
      return successResponse('The service is ready.', { status: 'ready' });
    } catch {
      throw new ServiceUnavailableException(
        'The service is temporarily unavailable. Please try again shortly.',
      );
    }
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ChallengeCatalogService {
  constructor(private readonly dataSource: DataSource) {}
  execute() {
    return this.dataSource.query('SELECT type, default_expiry_seconds, max_attempts, delivery_channel, template_key FROM challenges.catalog ORDER BY type');
  }
}

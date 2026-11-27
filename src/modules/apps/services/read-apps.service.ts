import { Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationRepository } from '../repositories/application.repository';

@Injectable()
export class ReadAppsService {
  constructor(private readonly applications: ApplicationRepository) {}

  async execute(appId?: string) {
    if (!appId) return this.applications.findAll();
    const app = await this.applications.findByIdOrSlug(appId);
    if (!app) throw new NotFoundException('We could not find this app.');
    return app;
  }
}

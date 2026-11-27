import { Module } from '@nestjs/common';
import { PolicyResolverService } from './policy-resolver.service';
import { SecurityModule } from '../security';
import { EventsModule } from '../events/events.module';

@Module({ imports: [SecurityModule, EventsModule], providers: [PolicyResolverService], exports: [PolicyResolverService] })
export class PolicyModule {}

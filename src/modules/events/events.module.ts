import { Module } from '@nestjs/common';
import { PublishDomainEventService } from './services';

@Module({
  providers: [PublishDomainEventService],
  exports: [PublishDomainEventService],
})
export class EventsModule {}

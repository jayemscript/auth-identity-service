import { Module } from '@nestjs/common';
import { SendEmailService } from './services';
@Module({providers:[SendEmailService],exports:[SendEmailService]})
export class MessagingModule {}

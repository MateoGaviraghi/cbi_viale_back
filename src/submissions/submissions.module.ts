import { Module } from '@nestjs/common'
import { EmailsModule } from '../emails/emails.module'
import { ServicesModule } from '../services/services.module'
import { SubmissionsController } from './submissions.controller'
import { SubmissionsService } from './submissions.service'

@Module({
  imports: [ServicesModule, EmailsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}

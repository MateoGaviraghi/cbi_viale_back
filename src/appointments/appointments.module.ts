import { Module } from '@nestjs/common'
import { AvailabilityModule } from '../availability/availability.module'
import { EmailsModule } from '../emails/emails.module'
import { ServicesModule } from '../services/services.module'
import { AppointmentsController } from './appointments.controller'
import { AppointmentsService } from './appointments.service'

@Module({
  imports: [ServicesModule, AvailabilityModule, EmailsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}

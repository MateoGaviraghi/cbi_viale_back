import { Module } from '@nestjs/common'
import { AppointmentsModule } from '../appointments/appointments.module'
import { ConsentsModule } from '../consents/consents.module'
import { SubmissionsModule } from '../submissions/submissions.module'
import { AdminController } from './admin.controller'

@Module({
  imports: [AppointmentsModule, SubmissionsModule, ConsentsModule],
  controllers: [AdminController],
})
export class AdminModule {}

import { Module } from '@nestjs/common'
import { ServicesModule } from '../services/services.module'
import { AvailabilityController } from './availability.controller'
import { AvailabilityService } from './availability.service'

@Module({
  imports: [ServicesModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService], // AppointmentsModule lo va a consumir
})
export class AvailabilityModule {}

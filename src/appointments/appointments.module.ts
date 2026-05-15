import { Module } from '@nestjs/common'
import { AvailabilityModule } from '../availability/availability.module'
import { ServicesModule } from '../services/services.module'
import { AppointmentsController } from './appointments.controller'
import { AppointmentsService } from './appointments.service'

@Module({
  // EmailsModule no se importa: está marcado @Global, EmailsService se inyecta
  // automáticamente. Importarlo acá crearía una 2da instancia sin queue.
  imports: [ServicesModule, AvailabilityModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}

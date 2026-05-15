import { Module } from '@nestjs/common'
import { ServicesModule } from '../services/services.module'
import { SubmissionsController } from './submissions.controller'
import { SubmissionsService } from './submissions.service'

@Module({
  // EmailsModule no se importa: está marcado @Global, EmailsService se inyecta
  // automáticamente. Importarlo acá crearía una 2da instancia sin queue.
  imports: [ServicesModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}

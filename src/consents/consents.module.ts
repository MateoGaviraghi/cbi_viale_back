import { Module } from '@nestjs/common'
import { ConsentsService } from './consents.service'

@Module({
  providers: [ConsentsService],
  exports: [ConsentsService],
})
export class ConsentsModule {}

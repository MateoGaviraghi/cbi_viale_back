import { ApiPropertyOptional } from '@nestjs/swagger'
import { FormStatus } from '@prisma/client'
import { IsEnum, IsOptional } from 'class-validator'

export class UpdateSubmissionDto {
  @ApiPropertyOptional({
    enum: FormStatus,
    description:
      'Transicionar a ANSWERED setea answeredAt + answeredBy automáticamente (primera transición solamente; idempotente si ya estaba en ANSWERED).',
  })
  @IsOptional()
  @IsEnum(FormStatus)
  status?: FormStatus
}

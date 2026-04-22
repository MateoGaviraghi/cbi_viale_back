import { ApiPropertyOptional } from '@nestjs/swagger'
import { AppointmentStatus } from '@prisma/client'
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateAppointmentDto {
  @ApiPropertyOptional({
    enum: AppointmentStatus,
    description:
      'Transicionar a CONFIRMED setea confirmedAt automáticamente. Para cancelar, usar POST /:id/cancel.',
  })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null
}

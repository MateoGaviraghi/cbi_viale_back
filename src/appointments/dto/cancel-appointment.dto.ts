import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CancelAppointmentDto {
  @ApiPropertyOptional({ maxLength: 300, example: 'Paciente avisó por teléfono' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  cancelReason?: string
}

import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate } from 'class-validator'

export class ReprogramAppointmentDto {
  @ApiProperty({
    example: '2026-05-15T13:30:00.000Z',
    type: String,
    format: 'date-time',
    description: 'Nueva fecha/hora ISO con tz explícita — revalidada contra slots del servicio',
  })
  @Type(() => Date)
  @IsDate({ message: 'date debe ser una fecha ISO 8601 válida' })
  date!: Date
}

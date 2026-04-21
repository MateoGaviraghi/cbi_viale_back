import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateBlockedDateDto {
  @ApiProperty({ example: '2026-05-01T00:00:00.000Z', type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate({ message: 'startDate debe ser una fecha ISO válida' })
  startDate!: Date

  @ApiProperty({
    example: '2026-05-01T23:59:59.999Z',
    type: String,
    format: 'date-time',
    description: 'Debe ser mayor o igual a startDate',
  })
  @Type(() => Date)
  @IsDate({ message: 'endDate debe ser una fecha ISO válida' })
  endDate!: Date

  @ApiPropertyOptional({ example: 'Feriado — Día del Trabajador', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string | null

  @ApiPropertyOptional({
    description: 'cuid del servicio (bloqueo específico). null/omitido = bloquea todos los servicios',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  serviceId?: string | null
}

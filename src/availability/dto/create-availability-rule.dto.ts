import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Weekday } from '@prisma/client'
import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator'

// Valida "HH:MM" en 24h (00:00–23:59)
const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export class CreateAvailabilityRuleDto {
  @ApiProperty({ enum: Weekday, example: 'MONDAY' })
  @IsEnum(Weekday)
  weekday!: Weekday

  @ApiProperty({ example: '07:00', description: 'Hora de inicio en formato HH:MM (24h)' })
  @IsString()
  @Matches(HHMM_REGEX, { message: 'startTime debe tener formato HH:MM (24h)' })
  startTime!: string

  @ApiProperty({ example: '12:00', description: 'Hora de fin en HH:MM, debe ser mayor que startTime' })
  @IsString()
  @Matches(HHMM_REGEX, { message: 'endTime debe tener formato HH:MM (24h)' })
  endTime!: string

  @ApiPropertyOptional({
    description: 'cuid del servicio (rule específica). null/omitido = rule global para todos los servicios',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  serviceId?: string | null

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}

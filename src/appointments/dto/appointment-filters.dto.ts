import { ApiPropertyOptional } from '@nestjs/swagger'
import { AppointmentStatus } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator'
import { PaginationDto } from '../../availability/dto/availability-filters.dto'

export class AppointmentFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus

  @ApiPropertyOptional({ example: 'clinica-humana' })
  @IsOptional()
  @IsString()
  serviceSlug?: string

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date

  @ApiPropertyOptional({ description: 'Búsqueda case-insensitive en nombre/DNI/email/teléfono' })
  @IsOptional()
  @IsString()
  q?: string
}

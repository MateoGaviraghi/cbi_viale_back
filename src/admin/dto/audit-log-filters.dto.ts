import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'
import { PaginationDto } from '../../availability/dto/availability-filters.dto'

/** Filtros del listado de audit log (admin). Hereda page/pageSize de PaginationDto. */
export class AuditLogFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtra por el usuario que ejecutó la acción' })
  @IsOptional()
  @IsString()
  userId?: string

  @ApiPropertyOptional({ example: 'Appointment', description: 'Entidad afectada' })
  @IsOptional()
  @IsString()
  entity?: string

  @ApiPropertyOptional({ example: 'APPOINTMENT_PATCH', description: 'Acción registrada' })
  @IsOptional()
  @IsString()
  action?: string
}

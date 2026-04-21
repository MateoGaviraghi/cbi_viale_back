import { ApiPropertyOptional } from '@nestjs/swagger'
import { Weekday } from '@prisma/client'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

/** Paginación base reutilizable en todos los list endpoints. */
export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20
}

export class RuleFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: Weekday })
  @IsOptional()
  @IsEnum(Weekday)
  weekday?: Weekday

  @ApiPropertyOptional({ example: 'clinica-humana' })
  @IsOptional()
  @IsString()
  serviceSlug?: string

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  // Query params llegan como strings — normalizamos a boolean real.
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean
}

export class BlockedDateFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Filtra bloques cuyo endDate >= from' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Filtra bloques cuyo startDate <= to' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date

  @ApiPropertyOptional({ example: 'clinica-humana' })
  @IsOptional()
  @IsString()
  serviceSlug?: string
}

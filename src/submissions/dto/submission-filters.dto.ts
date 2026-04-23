import { ApiPropertyOptional } from '@nestjs/swagger'
import { FormStatus, FormType } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator'
import { PaginationDto } from '../../availability/dto/availability-filters.dto'

export class SubmissionFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: FormType })
  @IsOptional()
  @IsEnum(FormType)
  type?: FormType

  @ApiPropertyOptional({ enum: FormStatus })
  @IsOptional()
  @IsEnum(FormStatus)
  status?: FormStatus

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

  @ApiPropertyOptional({ description: 'Búsqueda case-insensitive en name/email/subject/message' })
  @IsOptional()
  @IsString()
  q?: string
}

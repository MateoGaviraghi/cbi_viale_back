import { ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'
import { PaginationDto } from '../../availability/dto/availability-filters.dto'

export class UserFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({ type: Boolean, description: 'Filtra por estado active' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean

  @ApiPropertyOptional({ description: 'Search insensitive en name y email' })
  @IsOptional()
  @IsString()
  q?: string
}

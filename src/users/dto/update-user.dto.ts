import { ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator'

export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({
    description: 'false = soft delete (deshabilita login). true = reactiva.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}

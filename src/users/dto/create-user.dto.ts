import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator'

export class CreateUserDto {
  @ApiProperty({ example: 'Carla Empleada', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string

  @ApiProperty({ example: 'carla@cbiviale.com.ar' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string

  @ApiProperty({ minLength: 8, description: 'Mínimo 8 chars. Bcrypt 10 rounds.' })
  @IsString()
  @MinLength(8, { message: 'La password debe tener al menos 8 caracteres' })
  password!: string

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiPropertyOptional({
    description:
      'Permisos granulares. Keys válidas: manageAppointments, manageAvailability, manageSubmissions, manageUsers, viewAuditLog, exportData, viewAnalytics.',
    example: { manageAppointments: true, manageSubmissions: true },
  })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>
}

import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @ApiProperty({ example: 'admin@cbiviale.com.ar' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string

  @ApiProperty({ example: 'cbi-admin-2026', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Contraseña debe tener al menos 8 caracteres' })
  password!: string
}

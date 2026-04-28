import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class UpdatePasswordDto {
  @ApiProperty({ minLength: 8, description: 'Nueva password en texto plano. Bcrypt 10 rounds.' })
  @IsString()
  @MinLength(8, { message: 'La password debe tener al menos 8 caracteres' })
  newPassword!: string
}

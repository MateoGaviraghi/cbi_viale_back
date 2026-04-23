import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { FormType } from '@prisma/client'
import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator'

export class CreateSubmissionDto {
  @ApiProperty({
    enum: FormType,
    example: FormType.CONTACT_GENERAL,
    description: 'Tipo de formulario. SERVICE_INQUIRY requiere serviceSlug.',
  })
  @IsEnum(FormType)
  type!: FormType

  @ApiProperty({ example: 'María López', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string

  @ApiPropertyOptional({ example: '+543434567890', description: '8-15 dígitos, "+" opcional' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'Teléfono inválido (8-15 dígitos, con o sin +)' })
  phone?: string

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string

  @ApiProperty({ maxLength: 5000, example: 'Consulta sobre análisis hormonales...' })
  @IsString()
  @MaxLength(5000)
  message!: string

  @ApiPropertyOptional({
    description:
      'kebab-case del servicio (clinica-humana, medicina-regenerativa, etc.). Requerido si type === SERVICE_INQUIRY.',
  })
  @IsOptional()
  @IsString()
  serviceSlug?: string

  @ApiPropertyOptional({
    description: 'Campos extra del formulario (opcional). JSON stringified máx 10KB.',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  extraData?: Record<string, unknown>
}

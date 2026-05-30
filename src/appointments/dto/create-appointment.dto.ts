import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator'

export class CreateAppointmentDto {
  @ApiProperty({ example: 'clinica-humana', description: 'Slug kebab-case del servicio' })
  @IsString()
  serviceSlug!: string

  @ApiProperty({
    example: '2026-05-10T10:00:00.000Z',
    type: String,
    format: 'date-time',
    description:
      'Fecha/hora ISO 8601 con tz explícita (ej "...-03:00" o "...Z"). Debe coincidir exactamente con un slot válido del calendario.',
  })
  @Type(() => Date)
  @IsDate({ message: 'date debe ser una fecha ISO 8601 válida' })
  date!: Date

  @ApiProperty({ example: 'Juan Pérez', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  patientName!: string

  @ApiProperty({ example: '12345678', description: 'DNI argentino (7 u 8 dígitos)' })
  @IsString()
  @Matches(/^\d{7,8}$/, { message: 'DNI debe tener 7 u 8 dígitos' })
  patientDni!: string

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  patientEmail!: string

  @ApiProperty({ example: '+543434567890', description: 'Teléfono 8-15 dígitos, "+" opcional' })
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'Teléfono inválido (8-15 dígitos, con o sin +)' })
  patientPhone!: string

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string

  @ApiPropertyOptional({
    description: 'Obligatorio true para servicios con requiresConsent (MEDICINA_REGENERATIVA, GENETICA)',
  })
  @IsOptional()
  @IsBoolean()
  consentGiven?: boolean

  @ApiPropertyOptional({
    description:
      'URL del PNG de firma del paciente. Subido vía POST /uploads/signature/sign. Debe pertenecer al cloud propio.',
    example:
      'https://res.cloudinary.com/<cloud>/image/upload/v1/cbi-viale/consent-signatures/abc.png',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'signatureUrl inválida' })
  signatureUrl?: string
}

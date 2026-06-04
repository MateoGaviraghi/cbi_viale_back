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

/**
 * Formulario CLINICA_HUMANA — paciente humano que sube pedido médico.
 * Foto del pedido se sube primero a Cloudinary (POST /uploads/medical-order/sign)
 * y la URL final se manda en `medicalOrderUrl`.
 */
export class CreateClinicalSubmissionDto {
  @ApiProperty({ example: 'María López', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string

  @ApiProperty({ example: '30123456', description: '7-9 dígitos' })
  @IsString()
  @Matches(/^\d{7,9}$/, { message: 'DNI inválido (7-9 dígitos)' })
  dni!: string

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string

  @ApiProperty({ example: '1990-05-12', description: 'ISO date (YYYY-MM-DD o ISO 8601)' })
  @Type(() => Date)
  @IsDate({ message: 'Fecha de nacimiento inválida' })
  birthDate!: Date

  @ApiProperty({ example: '+5493434567890', description: '8-15 dígitos, "+" opcional' })
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'Celular inválido (8-15 dígitos, con o sin +)' })
  phone!: string

  @ApiPropertyOptional({ example: 'OSDE', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  healthInsurance?: string

  @ApiPropertyOptional({
    example: 'Dr. Pérez (MP 12345)',
    description: 'Médico solicitante con matrícula (MP o MN)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  requestingDoctor?: string

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string

  @ApiProperty({
    example: true,
    description: 'Checkbox de consentimiento. Debe ser true.',
  })
  @IsBoolean()
  consentGiven!: boolean

  @ApiProperty({
    example: 'https://res.cloudinary.com/<cloud>/image/upload/v1/medical-orders/abc123.jpg',
    description: 'URL devuelta por Cloudinary tras el upload firmado',
  })
  @IsUrl({ require_protocol: true }, { message: 'URL de pedido médico inválida' })
  medicalOrderUrl!: string

  @ApiPropertyOptional({
    description:
      'URL del PNG de firma del paciente (Cloudinary). Genera Consent vinculado a esta submission.',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'signatureUrl inválida' })
  signatureUrl?: string
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

/**
 * Formulario VAGINAL_EXUDATE — subformulario de CLINICAL.
 * Datos básicos (nombre/dni/email/phone) son opcionales: si viene linkeado al
 * CLINICAL padre vía `parentSubmissionId`, se heredan. Si viene standalone, el
 * front debe completarlos.
 */
export class CreateVaginalExudateSubmissionDto {
  @ApiPropertyOptional({
    description: 'ID del FormSubmission CLINICAL padre (si este exudado es subform de uno).',
  })
  @IsOptional()
  @IsString()
  parentSubmissionId?: string

  @ApiPropertyOptional({ example: 'María López', minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string

  @ApiPropertyOptional({ example: '30123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{7,9}$/, { message: 'DNI inválido (7-9 dígitos)' })
  dni?: string

  @ApiPropertyOptional({ example: 'maria@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string

  @ApiPropertyOptional({ example: '+5493434567890' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'Celular inválido (8-15 dígitos, con o sin +)' })
  phone?: string

  @ApiProperty({ example: 28, minimum: 0, maximum: 150 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  age!: number

  @ApiProperty({
    example: '2026-05-01',
    description: 'Fecha de última menstruación (ISO date).',
  })
  @Type(() => Date)
  @IsDate({ message: 'Fecha de última menstruación inválida' })
  lastMenstruationDate!: Date

  @ApiProperty({ example: 'Picazón y secreción anormal', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  symptoms!: string

  @ApiProperty({
    example: 1,
    description: 'Cantidad de embarazos previos.',
    minimum: 0,
    maximum: 30,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  pregnancies!: number

  @ApiProperty({
    example: 'Blanco grumoso, sin olor',
    description: 'Características del flujo.',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  flowCharacteristics!: string

  @ApiProperty({
    example: 'Pastillas anticonceptivas hace 2 años',
    description: 'Uso de anticonceptivos. Si no usa, escribir "Ninguno".',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  contraceptiveUse!: string

  @ApiProperty({
    example: 'Candidiasis hace 6 meses',
    description: 'Antecedentes de infecciones vaginales. Si no tiene, "Ninguno".',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  vaginalInfectionHistory!: string

  @ApiProperty({
    example: 0,
    description: 'Cantidad de abortos previos.',
    minimum: 0,
    maximum: 30,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  abortionCount!: number

  @ApiProperty({ example: true, description: 'Checkbox de consentimiento.' })
  @IsBoolean()
  consentGiven!: boolean
}

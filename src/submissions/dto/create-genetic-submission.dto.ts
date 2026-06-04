import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { GENETIC_STUDY_TYPES, type GeneticStudyType } from './form-options.constants'

/** Formulario GENETIC — estudios genéticos (filiación, identificación, molecular). */
export class CreateGeneticSubmissionDto {
  @ApiProperty({ example: 'María López', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string

  @ApiProperty({ example: '30123456' })
  @IsString()
  @Matches(/^\d{7,9}$/, { message: 'DNI inválido (7-9 dígitos)' })
  dni!: string

  @ApiProperty({ example: '+5493434567890' })
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'Teléfono inválido' })
  phone!: string

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string

  @ApiProperty({ enum: GENETIC_STUDY_TYPES, example: 'Filiación / paternidad' })
  @IsIn(GENETIC_STUDY_TYPES, {
    message: `studyType debe ser uno de: ${GENETIC_STUDY_TYPES.join(', ')}`,
  })
  studyType!: GeneticStudyType

  @ApiProperty({
    example: 'Confirmación de paternidad',
    description: 'Motivo del estudio',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  studyReason!: string

  @ApiPropertyOptional({
    example: 'Hermanos por parte de padre',
    description: 'Relación entre muestras (si aplica)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sampleRelationship?: string

  @ApiProperty({ example: 2, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  sampleCount!: number

  @ApiProperty({ example: '2026-05-15', description: 'Fecha de toma (ISO date)' })
  @Type(() => Date)
  @IsDate({ message: 'Fecha de toma inválida' })
  collectionDate!: Date

  @ApiPropertyOptional({
    example: 'Dr. Genetista Ramírez (MP 4567)',
    description: 'Profesional solicitante',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  requestingProfessional?: string

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string

  @ApiProperty({ example: true, description: 'Checkbox de consentimiento.' })
  @IsBoolean()
  consentGiven!: boolean

  @ApiProperty({
    example: 'Caucásica',
    description: 'Raza / etnia (relevante para algunos estudios genéticos).',
    maxLength: 80,
  })
  @IsString()
  @MaxLength(80)
  ethnicity!: string

  @ApiPropertyOptional({
    example: 'Diagnóstico reciente, sin tratamiento',
    description: 'Estado actual de la enfermedad (si aplica)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  diseaseStatus?: string

  @ApiPropertyOptional({
    example: false,
    description: 'Si tuvo trasplante de médula ósea (relevante para análisis molecular).',
  })
  @IsOptional()
  @IsBoolean()
  boneMarrowTransplant?: boolean

  @ApiProperty({
    example: 'Panel de 50 marcadores STR autosomales',
    description: 'Detalle del estudio solicitado',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  studyDetail!: string

  @ApiPropertyOptional({
    example: 'Cariotipo en 2020 — normal',
    description: 'Estudios genéticos previos (si aplica)',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  previousGeneticStudies?: string

  @ApiPropertyOptional({
    description:
      'URL del PNG de firma del paciente (Cloudinary). Genera Consent vinculado a esta submission.',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'signatureUrl inválida' })
  signatureUrl?: string
}

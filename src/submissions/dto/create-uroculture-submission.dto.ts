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
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { UROCULTURE_SAMPLE_TYPES, type UrocultureSampleType } from './form-options.constants'

/**
 * Formulario UROCULTURE — subformulario de CLINICAL.
 * El front lo envía cuando el pedido médico de Clínica Humana incluye urocultivo.
 *
 * Si viene linkeado al form Clínica Humana, mandar `parentSubmissionId` con el id
 * del CLINICAL submission. Si viene standalone, omitirlo.
 */
export class CreateUrocultureSubmissionDto {
  @ApiPropertyOptional({
    description: 'ID del FormSubmission CLINICAL padre (si este urocultivo es subform de uno).',
  })
  @IsOptional()
  @IsString()
  parentSubmissionId?: string

  @ApiProperty({ example: 'María López', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string

  @ApiProperty({ example: '30123456', description: '7-9 dígitos' })
  @IsString()
  @Matches(/^\d{7,9}$/, { message: 'DNI inválido (7-9 dígitos)' })
  dni!: string

  @ApiPropertyOptional({
    example: 'maria@example.com',
    description: 'Opcional si viene como subform (se hereda del padre).',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string

  @ApiPropertyOptional({
    example: '+5493434567890',
    description: 'Opcional si viene como subform.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'Celular inválido (8-15 dígitos, con o sin +)' })
  phone?: string

  @ApiProperty({ example: 34, minimum: 0, maximum: 150 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  age!: number

  @ApiProperty({ example: '08:30', description: 'Hora de recolección (HH:MM)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora inválida (HH:MM)' })
  collectionTime!: string

  @ApiProperty({ example: '2026-05-15', description: 'Fecha de recolección (ISO date)' })
  @Type(() => Date)
  @IsDate({ message: 'Fecha de recolección inválida' })
  collectionDate!: Date

  @ApiPropertyOptional({
    enum: UROCULTURE_SAMPLE_TYPES,
    description: 'Tipo de muestra (Sonda, Punción Suprapúbica, Chorro medio).',
  })
  @IsOptional()
  @IsIn(UROCULTURE_SAMPLE_TYPES, {
    message: `sampleType debe ser uno de: ${UROCULTURE_SAMPLE_TYPES.join(', ')}`,
  })
  sampleType?: UrocultureSampleType

  @ApiProperty({
    example: 'Ardor al orinar y dolor lumbar',
    maxLength: 2000,
  })
  @IsString()
  @MaxLength(2000)
  symptoms!: string

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  pregnancy?: boolean

  @ApiProperty({
    example: 'Amoxicilina desde el 10/05/2026',
    description: 'Indicar cuál antibiótico y desde cuándo. Si no recibió, escribir "Ninguno".',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  previousAntibiotics!: string

  @ApiProperty({
    example: 'Diabetes tipo 2',
    description: 'Patología de base. Escribir "Ninguna" si no aplica.',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  baselinePathology!: string

  @ApiProperty({ example: true, description: 'Checkbox de consentimiento.' })
  @IsBoolean()
  consentGiven!: boolean
}

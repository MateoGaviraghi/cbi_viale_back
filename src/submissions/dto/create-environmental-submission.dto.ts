import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsDate,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator'
import {
  ENVIRONMENTAL_ANALYSIS_TYPES,
  ENVIRONMENTAL_SAMPLE_TYPES,
  type EnvironmentalAnalysisType,
  type EnvironmentalSampleType,
} from './form-options.constants'

/** Formulario ENVIRONMENTAL — agua, efluentes y muestras ambientales. */
export class CreateEnvironmentalSubmissionDto {
  @ApiProperty({
    example: 'Cooperativa Agua Pura',
    description: 'Nombre o razón social',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @Length(2, 200)
  companyName!: string

  @ApiProperty({ example: '30-71234567-8', description: 'CUIT (11 dígitos)' })
  @IsString()
  @Matches(/^(\d{2}-?\d{8}-?\d{1}|\d{11})$/, {
    message: 'CUIT inválido (11 dígitos)',
  })
  cuit!: string

  @ApiProperty({ example: '+5493434567890' })
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'Teléfono inválido' })
  phone!: string

  @ApiProperty({ example: 'contacto@cooperativa.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string

  @ApiProperty({ enum: ENVIRONMENTAL_SAMPLE_TYPES, example: 'Agua de pozo' })
  @IsIn(ENVIRONMENTAL_SAMPLE_TYPES, {
    message: `sampleType debe ser uno de: ${ENVIRONMENTAL_SAMPLE_TYPES.join(', ')}`,
  })
  sampleType!: EnvironmentalSampleType

  @ApiProperty({
    example: 'Pozo norte planta industrial',
    description: 'Punto de muestreo',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  samplingPoint!: string

  @ApiProperty({
    example: 'Ruta 12 km 45, Paraná',
    description: 'Ubicación geográfica',
    maxLength: 300,
  })
  @IsString()
  @MaxLength(300)
  location!: string

  @ApiProperty({ example: '2026-05-15', description: 'Fecha de toma (ISO date)' })
  @Type(() => Date)
  @IsDate({ message: 'Fecha de toma inválida' })
  collectionDate!: Date

  @ApiPropertyOptional({
    example: '14:30',
    description: 'Hora de toma (HH:MM)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora inválida (HH:MM)' })
  collectionTime?: string

  @ApiProperty({ enum: ENVIRONMENTAL_ANALYSIS_TYPES, example: 'Bacteriológico' })
  @IsIn(ENVIRONMENTAL_ANALYSIS_TYPES, {
    message: `analysisType debe ser uno de: ${ENVIRONMENTAL_ANALYSIS_TYPES.join(', ')}`,
  })
  analysisType!: EnvironmentalAnalysisType

  @ApiPropertyOptional({
    example: 'Ing. Mario Pérez',
    description: 'Responsable de la toma',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  samplingResponsible?: string

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string
}

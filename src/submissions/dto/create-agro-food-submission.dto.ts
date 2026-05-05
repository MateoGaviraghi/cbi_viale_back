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
import { AGRO_FOOD_ANALYSIS_TYPES, type AgroFoodAnalysisType } from './form-options.constants'

/** Formulario AGRO_FOOD — análisis de productos alimenticios y materias primas. */
export class CreateAgroFoodSubmissionDto {
  @ApiProperty({
    example: 'Distribuidora Norte SA',
    description: 'Nombre o razón social',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @Length(2, 200)
  companyName!: string

  @ApiProperty({
    example: '30-71234567-8',
    description: 'CUIT (11 dígitos, con o sin guiones)',
  })
  @IsString()
  @Matches(/^(\d{2}-?\d{8}-?\d{1}|\d{11})$/, {
    message: 'CUIT inválido (11 dígitos)',
  })
  cuit!: string

  @ApiProperty({ example: '+5493434567890' })
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'Teléfono inválido' })
  phone!: string

  @ApiProperty({ example: 'contacto@distribuidora.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string

  @ApiProperty({ example: 'Harina de trigo 000', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  productType!: string

  @ApiPropertyOptional({ example: 'L-2026-0512', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  batch?: string

  @ApiPropertyOptional({ example: '2026-04-20', description: 'Fecha de elaboración (ISO date)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Fecha de elaboración inválida' })
  productionDate?: Date

  @ApiProperty({ enum: AGRO_FOOD_ANALYSIS_TYPES, example: 'Microbiológico' })
  @IsIn(AGRO_FOOD_ANALYSIS_TYPES, {
    message: `analysisType debe ser uno de: ${AGRO_FOOD_ANALYSIS_TYPES.join(', ')}`,
  })
  analysisType!: AgroFoodAnalysisType

  @ApiProperty({
    example: '500g',
    description: 'Cantidad de muestra (texto libre con unidad).',
    maxLength: 80,
  })
  @IsString()
  @MaxLength(80)
  sampleQuantity!: string

  @ApiProperty({ example: '2026-05-15', description: 'Fecha de toma (ISO date)' })
  @Type(() => Date)
  @IsDate({ message: 'Fecha de toma inválida' })
  collectionDate!: Date

  @ApiPropertyOptional({ example: 'Planta Rosario', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  origin?: string

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string
}

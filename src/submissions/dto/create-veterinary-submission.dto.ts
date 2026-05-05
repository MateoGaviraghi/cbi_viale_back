import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
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
import {
  VETERINARY_SAMPLE_TYPES,
  VETERINARY_SPECIES,
  type VeterinarySampleType,
  type VeterinarySpecies,
} from './form-options.constants'

/** Formulario VETERINARY — análisis para animales (mascota / ganado). */
export class CreateVeterinarySubmissionDto {
  @ApiProperty({ example: 'Juan García', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  ownerName!: string

  @ApiProperty({
    example: '30123456',
    description: 'DNI (7-9 dígitos) o CUIT (11 dígitos, con o sin guiones)',
  })
  @IsString()
  @Matches(/^(\d{7,9}|\d{2}-?\d{8}-?\d{1}|\d{11})$/, {
    message: 'DNI/CUIT inválido',
  })
  dniOrCuit!: string

  @ApiProperty({ example: '+5493434567890', description: '8-15 dígitos, "+" opcional' })
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: 'Teléfono inválido' })
  phone!: string

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string

  @ApiProperty({ example: 'Firulais', minLength: 1, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  animalName!: string

  @ApiProperty({ enum: VETERINARY_SPECIES, example: 'Canino' })
  @IsIn(VETERINARY_SPECIES, {
    message: `species debe ser uno de: ${VETERINARY_SPECIES.join(', ')}`,
  })
  species!: VeterinarySpecies

  @ApiProperty({ example: 'Labrador', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  breed!: string

  @ApiProperty({ example: 5, minimum: 0, maximum: 100, description: 'Edad del animal (años)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  animalAge!: number

  @ApiProperty({
    example: 'Dr. Veterinario Pérez (MV 12345)',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  requestingVet!: string

  @ApiProperty({ enum: VETERINARY_SAMPLE_TYPES, example: 'Sangre' })
  @IsIn(VETERINARY_SAMPLE_TYPES, {
    message: `sampleType debe ser uno de: ${VETERINARY_SAMPLE_TYPES.join(', ')}`,
  })
  sampleType!: VeterinarySampleType

  @ApiProperty({ example: '2026-05-15', description: 'Fecha de toma (ISO date)' })
  @Type(() => Date)
  @IsDate({ message: 'Fecha de toma inválida' })
  collectionDate!: Date

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string
}

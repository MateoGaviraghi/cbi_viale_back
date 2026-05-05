/**
 * Listas cerradas de selección por formulario.
 *
 * Se usan como `string + @IsIn(...)` en los DTOs (vs enums Prisma) para poder
 * ajustar/agregar valores sin requerir migración a la DB. Si las listas se
 * vuelven definitivas, conviene migrar a enums Prisma.
 */

// ============================================================================
//  UROCULTIVO
// ============================================================================
// Confirmados por el cliente en el doc FORMULARIOS-SERVICIOS.docx
export const UROCULTURE_SAMPLE_TYPES = [
  'Sonda',
  'Punción Suprapúbica',
  'Chorro medio',
] as const
export type UrocultureSampleType = (typeof UROCULTURE_SAMPLE_TYPES)[number]

// ============================================================================
//  VETERINARIA
// ============================================================================
export const VETERINARY_SPECIES = [
  'Canino',
  'Felino',
  'Equino',
  'Bovino',
  'Porcino',
  'Ovino',
  'Caprino',
  'Aves',
  'Otros',
] as const
export type VeterinarySpecies = (typeof VETERINARY_SPECIES)[number]

export const VETERINARY_SAMPLE_TYPES = [
  'Sangre',
  'Suero',
  'Orina',
  'Materia fecal',
  'Hisopado',
  'Tejido',
  'Líquido sinovial',
  'Otros',
] as const
export type VeterinarySampleType = (typeof VETERINARY_SAMPLE_TYPES)[number]

// ============================================================================
//  AGRO Y ALIMENTOS
// ============================================================================
export const AGRO_FOOD_ANALYSIS_TYPES = [
  'Microbiológico',
  'Fisicoquímico',
  'Composición nutricional',
  'Detección de contaminantes',
  'Pesticidas / agroquímicos',
  'Micotoxinas',
  'Otros',
] as const
export type AgroFoodAnalysisType = (typeof AGRO_FOOD_ANALYSIS_TYPES)[number]

// ============================================================================
//  AMBIENTAL
// ============================================================================
export const ENVIRONMENTAL_SAMPLE_TYPES = [
  'Agua potable',
  'Agua de pozo',
  'Agua de red',
  'Efluente cloacal',
  'Efluente industrial',
  'Aire',
  'Suelo',
  'Otros',
] as const
export type EnvironmentalSampleType = (typeof ENVIRONMENTAL_SAMPLE_TYPES)[number]

export const ENVIRONMENTAL_ANALYSIS_TYPES = [
  'Bacteriológico',
  'Fisicoquímico',
  'Metales pesados',
  'Detección de coliformes',
  'Otros',
] as const
export type EnvironmentalAnalysisType = (typeof ENVIRONMENTAL_ANALYSIS_TYPES)[number]

// ============================================================================
//  GENÉTICA
// ============================================================================
export const GENETIC_STUDY_TYPES = [
  'Filiación / paternidad',
  'Identificación forense',
  'Estudio molecular / mutaciones',
  'Cariotipo',
  'Estudio oncológico',
  'Otros',
] as const
export type GeneticStudyType = (typeof GENETIC_STUDY_TYPES)[number]

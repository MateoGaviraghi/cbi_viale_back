import { Injectable, NotFoundException } from '@nestjs/common'
import type { Service, ServiceSlug } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

// Mapa kebab-case (URL friendly) → enum Prisma
const SLUG_MAP: Record<string, ServiceSlug> = {
  'clinica-humana': 'CLINICA_HUMANA',
  veterinaria: 'VETERINARIA',
  'agro-alimentos': 'AGRO_ALIMENTOS',
  ambiental: 'AMBIENTAL',
  'medicina-regenerativa': 'MEDICINA_REGENERATIVA',
  genetica: 'GENETICA',
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista todos los servicios activos, ordenados por `order`. Incluye conteos de análisis/imágenes. */
  listActive(): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    })
  }

  async findBySlugOrThrow(slug: string) {
    const enumSlug = SLUG_MAP[slug]
    if (!enumSlug) throw new NotFoundException(`Servicio "${slug}" no existe`)

    const service = await this.prisma.service.findUnique({
      where: { slug: enumSlug },
      include: {
        images: { orderBy: { order: 'asc' } },
        analyses: { orderBy: { order: 'asc' } },
      },
    })
    if (!service || !service.active) {
      throw new NotFoundException(`Servicio "${slug}" no disponible`)
    }
    return service
  }
}

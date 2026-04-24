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

// Mapa inverso: enum Prisma → kebab-case para exponer al front.
// El endpoint acepta kebab-case, así que el response debería usar el MISMO formato
// que el input (evita que el front mantenga un mapa bidireccional).
const ENUM_TO_SLUG: Record<ServiceSlug, string> = {
  CLINICA_HUMANA: 'clinica-humana',
  VETERINARIA: 'veterinaria',
  AGRO_ALIMENTOS: 'agro-alimentos',
  AMBIENTAL: 'ambiental',
  MEDICINA_REGENERATIVA: 'medicina-regenerativa',
  GENETICA: 'genetica',
}

// Shape público: idéntico a Service pero con slug como string kebab-case.
export type PublicService = Omit<Service, 'slug'> & { slug: string }

function toPublicService<T extends { slug: ServiceSlug }>(s: T): Omit<T, 'slug'> & { slug: string } {
  return { ...s, slug: ENUM_TO_SLUG[s.slug] }
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista todos los servicios activos, ordenados por `order`. Slug expuesto en kebab-case. */
  async listActive(): Promise<PublicService[]> {
    const services = await this.prisma.service.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    })
    return services.map(toPublicService)
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
    return toPublicService(service)
  }
}

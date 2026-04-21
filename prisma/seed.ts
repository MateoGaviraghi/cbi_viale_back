/* eslint-disable no-console */
import { PrismaClient, ServiceSlug, UserRole, Weekday } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Semilla:
//  1. Crea los 6 servicios con descripciones placeholder.
//  2. Crea un admin inicial (email y pass por env; fallback dev).
//  3. Carga horarios de atención default — ajustables desde admin.

async function main() {
  console.log('🌱 Seeding CBI Viale...\n')

  // --- Servicios ---
  const services: Array<{
    slug: ServiceSlug
    name: string
    short: string
    duration: number
    consent: boolean
    order: number
  }> = [
    {
      slug: 'CLINICA_HUMANA',
      name: 'Clínica Humana',
      short: 'Análisis de rutina, hormonales, serológicos, vitaminas y prequirúrgicos.',
      duration: 30,
      consent: false,
      order: 1,
    },
    {
      slug: 'VETERINARIA',
      name: 'Veterinaria',
      short: 'Estudios para salud y nutrición animal.',
      duration: 30,
      consent: false,
      order: 2,
    },
    {
      slug: 'AGRO_ALIMENTOS',
      name: 'Agro y Alimentos',
      short:
        'Microbiológicos, composición de alimentos balanceados, nutrientes y calidad de materias primas.',
      duration: 45,
      consent: false,
      order: 3,
    },
    {
      slug: 'AMBIENTAL',
      name: 'Ambiental',
      short: 'Control de agua y efluentes.',
      duration: 30,
      consent: false,
      order: 4,
    },
    {
      slug: 'MEDICINA_REGENERATIVA',
      name: 'Medicina Regenerativa',
      short: 'Plasma Rico en Plaquetas (PRP).',
      duration: 60,
      consent: true,
      order: 5,
    },
    {
      slug: 'GENETICA',
      name: 'Genética',
      short: 'Estudios de paternidad.',
      duration: 30,
      consent: true,
      order: 6,
    },
  ]

  for (const s of services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        shortDescription: s.short,
        durationMinutes: s.duration,
        requiresConsent: s.consent,
        order: s.order,
      },
      create: {
        slug: s.slug,
        name: s.name,
        shortDescription: s.short,
        longDescription:
          '[Descripción larga pendiente — ver CONTENT.md]\n\nTexto placeholder para que el cliente complete durante Fase 1/2.',
        durationMinutes: s.duration,
        requiresConsent: s.consent,
        order: s.order,
      },
    })
    console.log(`  ✓ Service: ${s.name}`)
  }

  // --- Admin inicial ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@cbiviale.com.ar'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'cbi-admin-2026'
  const passwordHash = await bcrypt.hash(adminPassword, 10)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Admin CBI',
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      active: true,
      permissions: {},
    },
  })
  console.log(`  ✓ Admin inicial: ${adminEmail} (cambiar pass tras primer login)`)

  // --- Horarios default (placeholder — cliente los confirma) ---
  const weekdays: Weekday[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
  for (const wd of weekdays) {
    await prisma.availabilityRule.upsert({
      where: { id: `default-${wd}` },
      update: {},
      create: {
        id: `default-${wd}`,
        weekday: wd,
        startTime: '07:00',
        endTime: '12:00',
        active: true,
      },
    })
  }
  await prisma.availabilityRule.upsert({
    where: { id: 'default-SATURDAY' },
    update: {},
    create: {
      id: 'default-SATURDAY',
      weekday: 'SATURDAY',
      startTime: '08:00',
      endTime: '11:00',
      active: true,
    },
  })
  console.log(`  ✓ Horarios default cargados (placeholder)`)

  console.log('\n✅ Seed completado.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

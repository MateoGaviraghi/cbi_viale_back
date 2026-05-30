/**
 * Smoke test end-to-end del flujo de Consent con firma virtual.
 *
 * 1. Crea un FormSubmission + Consent en la DB con la firma de Cloudinary.
 * 2. Lee el Consent vía Prisma (verifica que las 4 columnas de firma persisten).
 * 3. Llama a ConsentsService.generatePdf() — descarga la firma de Cloudinary
 *    y la embebe en el PDF.
 * 4. Escribe el PDF a disco y lo abre.
 *
 * Bypasea los endpoints HTTP para no depender de Redis (BullMQ) que no
 * está corriendo localmente. La lógica testeada es la misma que ejecuta
 * SubmissionsService al recibir POST /submissions/clinical con signatureUrl.
 */
import { writeFileSync } from 'node:fs'
import { exec } from 'node:child_process'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'
import { ConsentsService } from '../src/consents/consents.service'

loadEnv()

async function main() {
  const prisma = new PrismaClient()

  console.log('─── 1. Cleanup previous smoke-test data ───')
  await prisma.consent.deleteMany({ where: { patientDni: 'SMOKE_TEST' } })
  await prisma.formSubmission.deleteMany({ where: { email: 'smoke-test@cbiviale.com.ar' } })

  console.log('─── 2. Buscar service clinica-humana ───')
  const service = await prisma.service.findUnique({ where: { slug: 'CLINICA_HUMANA' } })
  if (!service) throw new Error('Service clinica-humana no encontrado — corré db:seed primero')
  console.log(`  ✓ Service: ${service.name} (id=${service.id})`)

  console.log('─── 3. Crear FormSubmission + Consent (con firma) en una transacción ───')
  const { submission, consent } = await prisma.$transaction(async (tx) => {
    const submission = await tx.formSubmission.create({
      data: {
        type: 'CLINICAL',
        serviceId: service.id,
        name: 'Test Paciente E2E',
        email: 'smoke-test@cbiviale.com.ar',
        phone: '+5493432020527',
        message: 'Smoke test del flujo de Consent + firma',
        consentGiven: true,
        extraData: { dni: 'SMOKE_TEST', medicalOrderUrl: 'https://example.com/dummy.jpg' },
        status: 'PENDING',
      },
    })
    const consent = await tx.consent.create({
      data: {
        formSubmissionId: submission.id,
        patientName: 'Test Paciente E2E',
        patientDni: 'SMOKE_TEST',
        serviceName: service.name,
        serviceSlug: service.slug,
        appointmentDate: null,
        consentGivenAt: new Date(),
        ipAddress: '127.0.0.1',
        patientSignatureUrl:
          'https://res.cloudinary.com/demdyjvk8/image/upload/a_-90,e_make_transparent:30/v1780008713/firma-nahir_vyxsya.png',
        professionalSignatureUrl: process.env.PROFESSIONAL_SIGNATURE_URL || null,
        professionalName: process.env.PROFESSIONAL_NAME ?? 'Nahir Gastaldi',
        professionalRole: process.env.PROFESSIONAL_ROLE ?? 'Bioquímica · CBI Viale',
      },
    })
    return { submission, consent }
  })
  console.log(`  ✓ FormSubmission id: ${submission.id}`)
  console.log(`  ✓ Consent id: ${consent.id}`)
  console.log(`  ✓ patientSignatureUrl: ${consent.patientSignatureUrl?.slice(0, 80)}...`)
  console.log(`  ✓ professionalSignatureUrl: ${consent.professionalSignatureUrl?.slice(0, 80)}...`)
  console.log(`  ✓ professionalName: ${consent.professionalName}`)
  console.log(`  ✓ professionalRole: ${consent.professionalRole}`)

  console.log('─── 4. Re-leer con relación a FormSubmission (verificar admin view) ───')
  const fetched = await prisma.consent.findUnique({
    where: { id: consent.id },
    include: { formSubmission: { select: { type: true, email: true, status: true } } },
  })
  console.log(`  ✓ Consent re-leído. formSubmission.type: ${fetched?.formSubmission?.type}`)

  console.log('─── 5. Generar PDF via ConsentsService (descarga firmas y embebe) ───')
  // Inyectamos un mock con solo el método que el service usa.
  const fakePrismaForService = {
    consent: {
      findUnique: async () => fetched,
    },
  } as unknown as ConstructorParameters<typeof ConsentsService>[0]

  const service2 = new ConsentsService(fakePrismaForService)
  const { pdf, filename } = await service2.generatePdf(consent.id)
  const outPath = resolve(process.cwd(), 'smoke-test-consent.pdf')
  writeFileSync(outPath, pdf)
  console.log(`  ✓ PDF generado: ${outPath}`)
  console.log(`  ✓ filename interno: ${filename}`)
  console.log(`  ✓ Tamaño: ${(pdf.length / 1024).toFixed(0)} KB`)

  console.log('─── 6. Cleanup ───')
  await prisma.consent.delete({ where: { id: consent.id } })
  await prisma.formSubmission.delete({ where: { id: submission.id } })
  console.log('  ✓ Smoke test data borrada de la DB')

  await prisma.$disconnect()

  // Abrir el PDF
  if (process.platform === 'win32') {
    exec(`start "" "${outPath}"`)
  } else if (process.platform === 'darwin') {
    exec(`open "${outPath}"`)
  } else {
    exec(`xdg-open "${outPath}"`)
  }

  console.log('\n✅ Smoke test E2E completo. PDF abierto en visor predeterminado.')
}

main().catch((err) => {
  console.error('❌ Smoke test falló:', err)
  process.exit(1)
})

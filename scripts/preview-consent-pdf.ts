/**
 * Preview standalone del PDF de consentimiento.
 * Ejecuta: npx ts-node scripts/preview-consent-pdf.ts
 * Salida: ./consent-preview.pdf (se abre automáticamente en Windows)
 *
 * Si existe scripts/fixtures/firma-nahir.png, se usa como firma del profesional
 * vía un monkey-patch a global.fetch (el ConsentsService normalmente la baja
 * por HTTP desde Cloudinary). Para producción, subí esa PNG a Cloudinary y
 * pegá el secure_url en PROFESSIONAL_SIGNATURE_URL del .env.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { exec } from 'node:child_process'
import { resolve } from 'node:path'
import type { Consent } from '@prisma/client'
import { ConsentsService } from '../src/consents/consents.service'

// ── Monkey-patch fetch para soportar "url://local-fixture/<name>" ──────────
const LOCAL_FIXTURES: Record<string, string> = {
  'nahir': resolve(process.cwd(), 'scripts/fixtures/firma-nahir.png'),
  'paciente-demo': resolve(process.cwd(), 'scripts/fixtures/firma-paciente-demo.png'),
}

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input?.url
  if (typeof url === 'string' && url.startsWith('local://')) {
    const key = url.replace('local://', '')
    const path = LOCAL_FIXTURES[key]
    if (path && existsSync(path)) {
      const buf = readFileSync(path)
      return new Response(buf, { status: 200, headers: { 'content-type': 'image/png' } })
    }
    return new Response(null, { status: 404 })
  }
  return realFetch(input, init)
}) as typeof fetch

// Para previsualizar con firmas reales:
//   $env:SIG_PATIENT="https://res.cloudinary.com/..."; $env:SIG_PROFESSIONAL="..."; npx ts-node scripts/preview-consent-pdf.ts
// Para previsualizar el flujo de formulario público (sin appointmentDate):
//   $env:FROM_FORM="1"; npx ts-node scripts/preview-consent-pdf.ts
const fromForm = process.env.FROM_FORM === '1'

const mockConsent: Consent & { appointment: { patientEmail: string; patientPhone: string } | null } = {
  id: 'ckxv9z8a10001qzrk5d2h8f7b',
  appointmentId: fromForm ? null : 'apt_demo_001',
  formSubmissionId: fromForm ? 'sub_demo_001' : null,
  patientName: 'María Fernanda Gómez',
  patientDni: '32487119',
  serviceName: fromForm ? 'Clínica Humana' : 'Análisis Clínicos · Hemograma completo',
  serviceSlug: 'clinica-humana',
  appointmentDate: fromForm ? null : new Date('2026-06-12T13:30:00Z'),
  consentGivenAt: new Date('2026-05-26T15:42:11Z'),
  ipAddress: '190.18.74.221',
  createdAt: new Date('2026-05-26T15:42:11Z'),
  // local://nahir → lee scripts/fixtures/firma-nahir.png (override via env)
  patientSignatureUrl: process.env.SIG_PATIENT ?? 'local://paciente-demo',
  professionalSignatureUrl: process.env.SIG_PROFESSIONAL ?? 'local://nahir',
  professionalName: 'Nahir Gastaldi',
  professionalRole: 'Bioquímica · CBI Viale',
  appointment: fromForm ? null : { patientEmail: 'maria@example.com', patientPhone: '+5493432020527' },
}

const fakePrisma = {
  consent: {
    findUnique: async () => mockConsent,
  },
} as unknown as ConstructorParameters<typeof ConsentsService>[0]

async function main() {
  const service = new ConsentsService(fakePrisma)
  const { pdf, filename } = await service.generatePdf(mockConsent.id)
  const outPath = resolve(process.cwd(), 'consent-preview.pdf')
  writeFileSync(outPath, pdf)
  console.log(`[ok] PDF generado: ${outPath}`)
  console.log(`     filename interno: ${filename}`)

  if (process.platform === 'win32') {
    exec(`start "" "${outPath}"`)
  } else if (process.platform === 'darwin') {
    exec(`open "${outPath}"`)
  } else {
    exec(`xdg-open "${outPath}"`)
  }
}

main().catch((err) => {
  console.error('[error]', err)
  process.exit(1)
})

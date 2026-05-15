import { Injectable, NotFoundException } from '@nestjs/common'
import type { Consent } from '@prisma/client'
import { Prisma } from '@prisma/client'
import PDFDocument from 'pdfkit'
import type { PaginatedResponse } from '../availability/availability.service'
import { PrismaService } from '../prisma/prisma.service'
import type { ConsentFiltersDto } from './dto/consent-filters.dto'

@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: ConsentFiltersDto): Promise<PaginatedResponse<Consent>> {
    const where: Prisma.ConsentWhereInput = {}
    if (filters.serviceSlug) where.serviceSlug = filters.serviceSlug
    if (filters.dateFrom || filters.dateTo) {
      const range: Prisma.DateTimeFilter = {}
      if (filters.dateFrom) range.gte = filters.dateFrom
      if (filters.dateTo) range.lte = filters.dateTo
      where.appointmentDate = range
    }

    const [items, total] = await Promise.all([
      this.prisma.consent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.consent.count({ where }),
    ])

    return {
      data: items,
      meta: {
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    }
  }

  async getByIdOrThrow(id: string): Promise<Consent> {
    const consent = await this.prisma.consent.findUnique({
      where: { id },
      include: { appointment: { select: { patientEmail: true, patientPhone: true } } },
    })
    if (!consent) throw new NotFoundException('Consentimiento no encontrado')
    return consent
  }

  async generatePdf(id: string): Promise<{ pdf: Buffer; filename: string }> {
    const consent = await this.getByIdOrThrow(id)

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 60, size: 'A4' })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () =>
        resolve({ pdf: Buffer.concat(chunks), filename: `consentimiento-${consent.id}.pdf` }),
      )
      doc.on('error', reject)

      // ── Encabezado ──────────────────────────────────────────────────────
      doc.fontSize(20).font('Helvetica-Bold').text('CBI Viale', { align: 'center' })
      doc.fontSize(12).font('Helvetica').text('Centro Bioquímico Integral', { align: 'center' })
      doc.fontSize(10).fillColor('#666666').text('Viale, Entre Ríos · Argentina', { align: 'center' })
      doc.fillColor('#000000')

      doc.moveDown(0.5)
      doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#cccccc').stroke()
      doc.moveDown(0.8)

      doc.fontSize(15).font('Helvetica-Bold').text('CONSENTIMIENTO INFORMADO', { align: 'center' })
      doc.moveDown(1)

      // ── Datos del paciente ───────────────────────────────────────────────
      doc.fontSize(11).font('Helvetica-Bold').text('Datos del Paciente')
      doc.moveDown(0.3)
      doc.font('Helvetica').fontSize(10)
      doc.text(`Nombre y apellido:  ${consent.patientName}`)
      doc.text(`DNI:  ${consent.patientDni}`)
      doc.moveDown(0.8)

      // ── Datos del servicio ───────────────────────────────────────────────
      doc.fontSize(11).font('Helvetica-Bold').text('Servicio')
      doc.moveDown(0.3)
      doc.font('Helvetica').fontSize(10)
      doc.text(`Servicio:  ${consent.serviceName}`)
      doc.text(`Fecha del turno:  ${formatArgDate(consent.appointmentDate)}`)
      doc.moveDown(0.8)

      // ── Texto legal ──────────────────────────────────────────────────────
      doc.fontSize(11).font('Helvetica-Bold').text('Declaración de Consentimiento')
      doc.moveDown(0.3)
      doc.font('Helvetica').fontSize(10)
      const legal =
        `El/La paciente declara haber sido informado/a sobre el procedimiento ` +
        `"${consent.serviceName}" y presta su consentimiento libre y voluntario ` +
        `para su realización. El/La paciente ha tenido la oportunidad de realizar ` +
        `preguntas y estas han sido respondidas satisfactoriamente.`
      doc.text(legal, { align: 'justify', lineGap: 3 })
      doc.moveDown(0.8)

      // ── Registro digital ─────────────────────────────────────────────────
      doc.fontSize(11).font('Helvetica-Bold').text('Registro Digital')
      doc.moveDown(0.3)
      doc.font('Helvetica').fontSize(10)
      doc.text(`Fecha y hora de registro:  ${formatArgDate(consent.consentGivenAt, true)}`)
      if (consent.ipAddress) doc.text(`IP de origen:  ${consent.ipAddress}`)
      doc.moveDown(2)

      // ── Footer ───────────────────────────────────────────────────────────
      doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#cccccc').stroke()
      doc.moveDown(0.5)
      doc
        .fontSize(8)
        .fillColor('#888888')
        .text('Documento generado digitalmente — CBI Viale · Viale, Entre Ríos', {
          align: 'center',
        })
      doc.text(`ID de consentimiento: ${consent.id}`, { align: 'center' })

      doc.end()
    })
  }
}

function formatArgDate(date: Date, includeTime = false): string {
  // Argentina (UTC-3), sin dependencia de librerías extra
  const arg = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  const dd = String(arg.getUTCDate()).padStart(2, '0')
  const mm = String(arg.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = arg.getUTCFullYear()
  if (!includeTime) return `${dd}/${mm}/${yyyy}`
  const hh = String(arg.getUTCHours()).padStart(2, '0')
  const min = String(arg.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min} (hora ARG)`
}

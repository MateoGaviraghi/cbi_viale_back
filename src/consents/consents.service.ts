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
    // Incluimos ambas relaciones — solo una estará seteada según el origen
    // (turno presencial vs formulario público). El admin necesita ver los
    // datos de contacto para responder o seguir el caso.
    const consent = await this.prisma.consent.findUnique({
      where: { id },
      include: {
        appointment: { select: { patientEmail: true, patientPhone: true, status: true } },
        formSubmission: {
          select: { type: true, email: true, phone: true, status: true, message: true },
        },
      },
    })
    if (!consent) throw new NotFoundException('Consentimiento no encontrado')
    return consent
  }

  async generatePdf(id: string): Promise<{ pdf: Buffer; filename: string }> {
    const consent = await this.getByIdOrThrow(id)

    // Paleta CBI (alineada con templates de email)
    const GOLD = '#8A6D3F'
    const GOLD_SOFT = '#A88958'
    const INK = '#1A1A1A'
    const INK_SOFT = '#3D3D3D'
    const MUTED = '#6B6B6B'
    const FOOTER = '#9A9A9A'
    const LINE = '#E5DED1'
    const BG_ALT = '#F5F0E8'

    // Snapshot del firmante grabado al momento del consentimiento. Fallback a
    // strings vacíos para consents legacy que no tienen el dato.
    const PROFESSIONAL_NAME = consent.professionalName ?? ''
    const PROFESSIONAL_ROLE = consent.professionalRole ?? ''

    // Descarga ambas firmas en paralelo antes de renderizar — el stream de
    // PDFKit es síncrono, no podemos await dentro del Promise.
    const [patientSignatureBuf, professionalSignatureBuf] = await Promise.all([
      fetchImageBuffer(consent.patientSignatureUrl),
      fetchImageBuffer(consent.professionalSignatureUrl),
    ])

    return new Promise((resolve, reject) => {
      // margin: 0 → controlamos todas las coordenadas manualmente y evitamos
      // que PDFKit dispare addPage() al escribir cerca del pie de página.
      const doc = new PDFDocument({ margin: 0, size: 'A4' })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () =>
        resolve({ pdf: Buffer.concat(chunks), filename: `consentimiento-${consent.id}.pdf` }),
      )
      doc.on('error', reject)

      // ── Constantes de página ────────────────────────────────────────────
      const PAGE_W = 595
      const PAGE_H = 842
      const M = 56
      const CONTENT_W = PAGE_W - M * 2
      const COL_GAP = 28
      const COL_W = (CONTENT_W - COL_GAP) / 2
      const COL2_X = M + COL_W + COL_GAP

      // ── Helpers ─────────────────────────────────────────────────────────
      const eyebrow = (text: string, yPos: number, x = M, width = CONTENT_W, align: 'left' | 'center' = 'left') => {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(GOLD)
          .text(text.toUpperCase(), x, yPos, { width, align, characterSpacing: 2.4 })
        if (align === 'left') {
          doc
            .moveTo(x, yPos + 12)
            .lineTo(x + 22, yPos + 12)
            .lineWidth(0.8)
            .strokeColor(GOLD_SOFT)
            .stroke()
        }
        return yPos + (align === 'left' ? 22 : 14)
      }

      const labelValue = (label: string, value: string, x: number, yPos: number, width: number) => {
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(MUTED)
          .text(label.toUpperCase(), x, yPos, { width, characterSpacing: 1.2 })
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor(INK)
          .text(value, x, yPos + 13, { width, lineBreak: false, ellipsis: true })
        return yPos + 40
      }

      // ── Banner dorado top ───────────────────────────────────────────────
      doc.rect(0, 0, PAGE_W, 5).fill(GOLD)

      // ── Header ──────────────────────────────────────────────────────────
      let y = 36
      doc
        .font('Times-Bold')
        .fontSize(26)
        .fillColor(GOLD)
        .text('CBI Viale', M, y, { width: CONTENT_W, align: 'center', characterSpacing: 0.4 })
      y += 30
      doc
        .font('Times-Italic')
        .fontSize(11)
        .fillColor(MUTED)
        .text('Centro Bioquímico Integral', M, y, { width: CONTENT_W, align: 'center' })
      y += 14
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED)
        .text('Viale, Entre Ríos · Argentina', M, y, {
          width: CONTENT_W,
          align: 'center',
          characterSpacing: 0.6,
        })
      y += 22

      // Línea separadora superior
      doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(LINE).lineWidth(0.6).stroke()
      y += 24

      // ── Título del documento ────────────────────────────────────────────
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(GOLD)
        .text('DOCUMENTO LEGAL', M, y, {
          width: CONTENT_W,
          align: 'center',
          characterSpacing: 2.5,
        })
      y += 14
      doc
        .font('Times-Bold')
        .fontSize(22)
        .fillColor(INK)
        .text('Consentimiento Informado', M, y, { width: CONTENT_W, align: 'center' })
      y += 42

      // ── Paciente + Servicio (2 columnas) ────────────────────────────────
      const sectionTopY = y
      eyebrow('Paciente', sectionTopY, M, COL_W)
      let yL = sectionTopY + 22
      yL = labelValue('Nombre y apellido', consent.patientName, M, yL, COL_W)
      yL = labelValue('DNI', consent.patientDni, M, yL, COL_W)

      eyebrow('Servicio', sectionTopY, COL2_X, COL_W)
      let yR = sectionTopY + 22
      yR = labelValue('Servicio', consent.serviceName, COL2_X, yR, COL_W)
      // Si el consent viene de un Appointment hay appointmentDate; si viene de
      // una FormSubmission caemos a createdAt y cambiamos el label.
      const dateLabel = consent.appointmentDate ? 'Fecha del turno' : 'Fecha de la solicitud'
      const dateValue = formatArgDate(consent.appointmentDate ?? consent.createdAt)
      yR = labelValue(dateLabel, dateValue, COL2_X, yR, COL_W)

      y = Math.max(yL, yR) + 20

      // ── Declaración con checkbox ─────────────────────────────────────────
      y = eyebrow('Declaración', y)

      const checkboxSize = 11
      const checkboxX = M
      const checkboxY = y + 2
      doc
        .rect(checkboxX, checkboxY, checkboxSize, checkboxSize)
        .lineWidth(1)
        .strokeColor(GOLD)
        .stroke()
      doc
        .moveTo(checkboxX + 2, checkboxY + 6)
        .lineTo(checkboxX + 4.5, checkboxY + 8.5)
        .lineTo(checkboxX + 9, checkboxY + 3)
        .lineWidth(1.4)
        .strokeColor(GOLD)
        .stroke()

      const declarationText =
        'Declaro que la información brindada es correcta y autorizo al Centro Bioquímico Integral ' +
        'a utilizar los datos y muestras proporcionadas para fines analíticos, diagnósticos y de ' +
        'control de calidad, conforme a las condiciones e indicaciones del laboratorio.'

      const decX = checkboxX + checkboxSize + 10
      const decW = CONTENT_W - (checkboxSize + 10)
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(INK_SOFT)
        .text(declarationText, decX, y, { width: decW, align: 'justify', lineGap: 2.5 })

      const decHeight = doc.heightOfString(declarationText, { width: decW, lineGap: 2.5 })
      const finePrintY = y + decHeight + 6

      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(MUTED)
        .text('Al continuar, usted acepta las condiciones generales del laboratorio.', decX, finePrintY, {
          width: decW,
        })

      y = finePrintY + 36

      // ── Registro digital (3 columnas horizontales) ──────────────────────
      y = eyebrow('Registro digital', y)

      const regGap = 16
      const regColW = (CONTENT_W - regGap * 2) / 3
      labelValue('Fecha y hora', formatArgDate(consent.consentGivenAt, true), M, y, regColW)
      labelValue('IP de origen', consent.ipAddress ?? '—', M + regColW + regGap, y, regColW)
      labelValue('ID de consentimiento', consent.id, M + (regColW + regGap) * 2, y, regColW)

      // ── FIRMAS + FOOTER (anclados al pie de página) ──────────────────────
      const FOOTER_BOTTOM_PAD = 30
      const FOOTER_LINE_Y = PAGE_H - FOOTER_BOTTOM_PAD - 22
      const SIG_LABELS_BLOCK_H = 36
      const SIG_LINE_GAP = 6
      const SIG_BOX_H = 110
      const SIG_EYEBROW_SPACING = 24

      const sigLineY = FOOTER_LINE_Y - 18 - SIG_LABELS_BLOCK_H
      const sigBoxY = sigLineY - SIG_LINE_GAP - SIG_BOX_H
      const sigEyebrowY = sigBoxY - SIG_EYEBROW_SPACING

      // Eyebrow "FIRMAS" centrado
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(GOLD)
        .text('FIRMAS', M, sigEyebrowY, {
          width: CONTENT_W,
          align: 'center',
          characterSpacing: 2.5,
        })

      const sigBoxGap = 50
      const sigBoxW = (CONTENT_W - sigBoxGap) / 2
      const sigLeftX = M
      const sigRightX = M + sigBoxW + sigBoxGap

      // Cajas de firma en BLANCO: la firma del paciente viene con fondo blanco
      // (canvas) y así se funde sin que se note el recuadro de la imagen.
      doc.rect(sigLeftX, sigBoxY, sigBoxW, SIG_BOX_H).fillColor('#FFFFFF').fill()
      doc.rect(sigRightX, sigBoxY, sigBoxW, SIG_BOX_H).fillColor('#FFFFFF').fill()

      // Firmas embebidas (si hay buffers descargados). Padding chico para que
      // la firma ocupe casi toda la caja; fit centrado preserva aspect ratio.
      const SIG_PAD = 4
      if (patientSignatureBuf) {
        doc.image(patientSignatureBuf, sigLeftX + SIG_PAD, sigBoxY + SIG_PAD, {
          fit: [sigBoxW - SIG_PAD * 2, SIG_BOX_H - SIG_PAD * 2],
          align: 'center',
          valign: 'center',
        })
      }
      if (professionalSignatureBuf) {
        doc.image(professionalSignatureBuf, sigRightX + SIG_PAD, sigBoxY + SIG_PAD, {
          fit: [sigBoxW - SIG_PAD * 2, SIG_BOX_H - SIG_PAD * 2],
          align: 'center',
          valign: 'center',
        })
      }

      // Líneas para firmar
      doc
        .moveTo(sigLeftX, sigLineY)
        .lineTo(sigLeftX + sigBoxW, sigLineY)
        .lineWidth(0.8)
        .strokeColor(INK)
        .stroke()
      doc
        .moveTo(sigRightX, sigLineY)
        .lineTo(sigRightX + sigBoxW, sigLineY)
        .lineWidth(0.8)
        .strokeColor(INK)
        .stroke()

      // Labels debajo de las líneas (paciente)
      const sigLabelY = sigLineY + 5
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(INK)
        .text('Firma del paciente', sigLeftX, sigLabelY, { width: sigBoxW, align: 'center' })
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(INK_SOFT)
        .text(consent.patientName, sigLeftX, sigLabelY + 11, {
          width: sigBoxW,
          align: 'center',
        })
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(`DNI ${consent.patientDni}`, sigLeftX, sigLabelY + 22, {
          width: sigBoxW,
          align: 'center',
        })

      // Labels debajo de las líneas (profesional)
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(INK)
        .text('Firma profesional', sigRightX, sigLabelY, { width: sigBoxW, align: 'center' })
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(INK_SOFT)
        .text(PROFESSIONAL_NAME, sigRightX, sigLabelY + 11, {
          width: sigBoxW,
          align: 'center',
        })
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(PROFESSIONAL_ROLE, sigRightX, sigLabelY + 22, {
          width: sigBoxW,
          align: 'center',
        })

      // Footer (línea + 2 líneas centradas)
      doc
        .moveTo(M, FOOTER_LINE_Y)
        .lineTo(PAGE_W - M, FOOTER_LINE_Y)
        .strokeColor(LINE)
        .lineWidth(0.6)
        .stroke()
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(FOOTER)
        .text(
          'CBI Viale · Manuel Belgrano 594, Viale, Entre Ríos · Documento generado digitalmente',
          M,
          FOOTER_LINE_Y + 7,
          { width: CONTENT_W, align: 'center', characterSpacing: 0.3 },
        )
      doc
        .font('Helvetica-Oblique')
        .fontSize(7)
        .fillColor(FOOTER)
        .text('Donde la ciencia y el cuidado se encuentran', M, FOOTER_LINE_Y + 18, {
          width: CONTENT_W,
          align: 'center',
        })

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

/**
 * Descarga una imagen y la devuelve como Buffer. Si la URL es null/inválida o
 * el fetch falla, devuelve null — el caller decide qué hacer (en el PDF, no
 * pintar nada y mantener la caja vacía).
 */
async function fetchImageBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

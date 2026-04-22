import { Injectable, Logger } from '@nestjs/common'
import type { EmailKind } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export interface EmailEnqueueParams {
  kind: EmailKind
  to: string
  subject: string
  appointmentId?: string
  payload: Record<string, unknown>
}

/**
 * STUB — esta es la Fase B2 mínima. En B2 completo se reemplaza la
 * implementación por una queue BullMQ + worker que renderiza React Email
 * templates y despacha con Resend. El CONTRATO (.enqueue) se mantiene,
 * así AppointmentsService no se toca cuando se complete B2.
 *
 * Modo actual (dev sin RESEND_API_KEY, según PLAN.md sección B2):
 *  - Log estructurado a Pino con el payload completo.
 *  - Crea EmailLog con status=SENT y sentAt=now para tener trazabilidad.
 */
@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(params: EmailEnqueueParams): Promise<void> {
    this.logger.log({
      event: 'email.enqueue (stub)',
      kind: params.kind,
      to: params.to,
      subject: params.subject,
      appointmentId: params.appointmentId,
      payload: params.payload,
    })

    await this.prisma.emailLog.create({
      data: {
        kind: params.kind,
        to: params.to,
        subject: params.subject,
        status: 'SENT',
        appointmentId: params.appointmentId ?? null,
        sentAt: new Date(),
      },
    })
  }
}

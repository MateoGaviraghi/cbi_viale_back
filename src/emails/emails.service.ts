import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Queue } from 'bullmq'
import type { Env } from '../config/env.schema'
import { PrismaService } from '../prisma/prisma.service'
import { EMAIL_JOB_NAME, EMAIL_QUEUE_NAME } from './emails.constants'
import type { EmailEnqueueParams, EmailJobData } from './emails.types'

/**
 * Dos modos de operación decididos al boot por `RESEND_API_KEY`:
 *  - DIRECT (key vacía): crea `EmailLog` status=SENT inmediato + loguea a Pino.
 *    No toca Redis ni Resend. Útil para dev sin API key.
 *  - QUEUE (key seteada): crea `EmailLog` status=QUEUED + encola job BullMQ.
 *    El processor consume, renderiza, despacha con Resend, actualiza el log.
 *
 * El contrato público `.enqueue()` es idéntico en ambos modos — los callsites
 * de AppointmentsService no necesitan saber cuál está activo.
 */
@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name)
  private readonly isDirectMode: boolean

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(EMAIL_QUEUE_NAME) private readonly queue: Queue<EmailJobData>,
  ) {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true })
    this.isDirectMode = !apiKey || apiKey.trim() === ''
    this.logger.log(
      this.isDirectMode
        ? 'Modo DIRECT (RESEND_API_KEY vacía) — emails loguean + EmailLog SENT inmediato, no se encolan'
        : 'Modo QUEUE — emails se encolan en BullMQ, procesados por EmailsProcessor + Resend',
    )
  }

  async enqueue(params: EmailEnqueueParams): Promise<void> {
    // Pre-crea el EmailLog. En DIRECT ya queda como SENT; en QUEUE queda
    // QUEUED y el processor lo mueve a SENT/FAILED después.
    const log = await this.prisma.emailLog.create({
      data: {
        kind: params.kind,
        to: params.to,
        subject: params.subject,
        status: this.isDirectMode ? 'SENT' : 'QUEUED',
        appointmentId: params.appointmentId ?? null,
        sentAt: this.isDirectMode ? new Date() : null,
      },
    })

    if (this.isDirectMode) {
      this.logger.log({
        event: 'email.direct',
        emailLogId: log.id,
        kind: params.kind,
        to: params.to,
        subject: params.subject,
        appointmentId: params.appointmentId,
        payload: params.payload,
      })
      return
    }

    await this.queue.add(EMAIL_JOB_NAME, {
      emailLogId: log.id,
      kind: params.kind,
      to: params.to,
      subject: params.subject,
      payload: params.payload,
    })
  }
}

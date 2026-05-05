import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger, Optional } from '@nestjs/common'
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
    // Optional: en modo DIRECT el módulo no registra BullMQ, así que la queue
    // viene undefined. EmailsService nunca la toca en ese modo.
    @Optional() @InjectQueue(EMAIL_QUEUE_NAME) private readonly queue?: Queue<EmailJobData>,
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

    // En modo QUEUE la queue siempre está inyectada (EmailsModule.forRoot la
     // registra cuando RESEND_API_KEY tiene valor). Si llegó hasta acá sin queue
     // hay un bug de configuración.
    if (!this.queue) {
      throw new Error('Modo QUEUE activo pero la queue no fue inyectada (revisar EmailsModule.forRoot)')
    }
    // TS pierde la correlación kind ↔ payload al reconstruir el objeto desde
    // un union discriminado (limitación conocida). `params` ya fue validado al
    // entrar por el tipo del argumento — la re-afirmación acá es segura.
    const jobData = { emailLogId: log.id, ...params } as EmailJobData
    await this.queue.add(EMAIL_JOB_NAME, jobData)
  }
}

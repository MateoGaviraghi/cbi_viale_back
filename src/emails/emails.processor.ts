import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { EmailKind } from '@prisma/client'
import { render } from '@react-email/render'
import type { Job } from 'bullmq'
import { createElement } from 'react'
import { Resend } from 'resend'
import type { Env } from '../config/env.schema'
import { PrismaService } from '../prisma/prisma.service'
import { EMAIL_QUEUE_NAME } from './emails.constants'
import type { EmailJobData } from './emails.types'
import AppointmentCancelled from './templates/appointment-cancelled'
import AppointmentConfirmation from './templates/appointment-confirmation'
import AppointmentReminder24h from './templates/appointment-reminder-24h'
import FormSubmissionReceipt from './templates/form-submission-receipt'
import InternalNotification from './templates/internal-notification'

/**
 * Worker BullMQ que consume la queue `emails`, renderiza el template
 * correspondiente, despacha via Resend y actualiza `EmailLog`.
 *
 * Retries: config en el module vía `defaultJobOptions` (3 attempts, backoff
 * exponencial 2s/4s/8s). Tras el último fallo marca `EmailLog` como FAILED.
 *
 * NOTA: este processor solo se activa en modo QUEUE (RESEND_API_KEY set).
 * En modo DIRECT el service nunca encola, así que este Worker idlea en Redis.
 */
@Processor(EMAIL_QUEUE_NAME, { concurrency: 5 })
export class EmailsProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailsProcessor.name)
  private readonly resend: Resend | null
  private readonly from: string
  private readonly replyTo: string

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super()
    const apiKey = config.get('RESEND_API_KEY', { infer: true })
    this.resend = apiKey && apiKey.trim() !== '' ? new Resend(apiKey) : null
    this.from = config.get('RESEND_FROM_EMAIL', { infer: true })
    this.replyTo = config.get('RESEND_REPLY_TO', { infer: true })
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { emailLogId, kind, to, subject, payload } = job.data

    // Safety net — si alguien encolara en modo direct (no debería pasar), fail-fast.
    if (!this.resend) {
      throw new Error('EmailsProcessor activo sin RESEND_API_KEY — revisar EmailsService.enqueue')
    }

    try {
      const html = await this.renderByKind(kind, payload)
      const result = await this.resend.emails.send({
        from: this.from,
        to,
        replyTo: this.replyTo,
        subject,
        html,
      })

      if (result.error) {
        throw new Error(`Resend error: ${result.error.message}`)
      }

      await this.prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'SENT',
          providerId: result.data?.id ?? null,
          sentAt: new Date(),
        },
      })

      this.logger.log({
        event: 'email.sent',
        emailLogId,
        kind,
        to,
        providerId: result.data?.id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const attempts = job.opts?.attempts ?? 1
      const attemptsMade = job.attemptsMade + 1 // attemptsMade es 0-indexed hasta que el job termina

      this.logger.warn({
        event: 'email.attempt_failed',
        emailLogId,
        kind,
        to,
        attemptsMade,
        totalAttempts: attempts,
        error: message,
      })

      // Marcar FAILED en EmailLog solo si es el último intento.
      if (attemptsMade >= attempts) {
        await this.prisma.emailLog.update({
          where: { id: emailLogId },
          data: { status: 'FAILED', error: message },
        })
      }

      throw err // deja que BullMQ reintente
    }
  }

  private async renderByKind(
    kind: EmailKind,
    payload: Record<string, unknown>,
  ): Promise<string> {
    switch (kind) {
      case 'APPOINTMENT_CONFIRMATION':
        return render(createElement(AppointmentConfirmation, payload as never))
      case 'APPOINTMENT_CANCELLED':
        return render(createElement(AppointmentCancelled, payload as never))
      case 'APPOINTMENT_REMINDER_24H':
        return render(createElement(AppointmentReminder24h, payload as never))
      case 'FORM_RECEIPT':
        return render(createElement(FormSubmissionReceipt, payload as never))
      case 'INTERNAL_NOTIFICATION':
        return render(createElement(InternalNotification, payload as never))
    }
  }
}

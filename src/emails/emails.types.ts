import type { EmailKind } from '@prisma/client'

/**
 * Payload del job BullMQ. `emailLogId` es el id del registro pre-creado
 * en `EmailLog` (status=QUEUED). El processor lo actualiza a SENT/FAILED
 * cuando termina.
 *
 * `payload` se tipa como Record<string, unknown> porque varía por kind.
 * El processor lo castea al tipo de props del template correspondiente.
 */
export interface EmailJobData {
  emailLogId: string
  kind: EmailKind
  to: string
  subject: string
  payload: Record<string, unknown>
}

export interface EmailEnqueueParams {
  kind: EmailKind
  to: string
  subject: string
  appointmentId?: string
  payload: Record<string, unknown>
}

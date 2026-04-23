import type { AppointmentCancelledProps } from './templates/appointment-cancelled'
import type { AppointmentConfirmationProps } from './templates/appointment-confirmation'
import type { AppointmentReminder24hProps } from './templates/appointment-reminder-24h'
import type { FormSubmissionReceiptProps } from './templates/form-submission-receipt'
import type { InternalNotificationProps } from './templates/internal-notification'

/**
 * Discriminated union por `kind`: el compilador fuerza que el `payload` matchee
 * el shape de props del template correspondiente. Si un callsite arma un payload
 * que no respeta la interfaz (ej. INTERNAL_NOTIFICATION sin `variant`), falla
 * en compile-time — no se entera uno en prod viendo el email mal renderizado.
 */
interface BaseEnqueueParams {
  to: string
  subject: string
  appointmentId?: string
}

export type EmailEnqueueParams =
  | (BaseEnqueueParams & { kind: 'APPOINTMENT_CONFIRMATION'; payload: AppointmentConfirmationProps })
  | (BaseEnqueueParams & { kind: 'APPOINTMENT_CANCELLED'; payload: AppointmentCancelledProps })
  | (BaseEnqueueParams & { kind: 'APPOINTMENT_REMINDER_24H'; payload: AppointmentReminder24hProps })
  | (BaseEnqueueParams & { kind: 'FORM_RECEIPT'; payload: FormSubmissionReceiptProps })
  | (BaseEnqueueParams & { kind: 'INTERNAL_NOTIFICATION'; payload: InternalNotificationProps })

/**
 * Payload del job BullMQ. Es `EmailEnqueueParams` + el id del EmailLog que se
 * pre-creó en `.enqueue()`. El processor lo actualiza a SENT/FAILED al terminar.
 */
export type EmailJobData = EmailEnqueueParams & { emailLogId: string }

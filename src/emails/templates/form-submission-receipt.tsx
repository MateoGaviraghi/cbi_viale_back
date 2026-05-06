import { Section, Text } from '@react-email/components'
import { InfoRow } from './components/InfoRow'
import { Layout } from './components/Layout'
import { eyebrow, footnote, heading, infoBox, paragraph } from './styles'

export interface FormSubmissionReceiptProps {
  name: string
  subject?: string | null
  message: string
  serviceName?: string | null
}

export default function FormSubmissionReceipt({
  name,
  subject = null,
  message,
  serviceName = null,
}: FormSubmissionReceiptProps) {
  const preview = `Recibimos tu consulta${serviceName ? ` sobre ${serviceName}` : ''}`

  return (
    <Layout preview={preview}>
      <Text style={eyebrow}>Solicitud recibida</Text>
      <Text style={heading}>Recibimos tu consulta</Text>
      <Text style={paragraph}>
        Hola {name}, te confirmamos que tu consulta llegó a nuestro equipo. Te vamos
        a responder a la brevedad durante los horarios de atención.
      </Text>
      <Section style={infoBox}>
        {serviceName && <InfoRow label="Servicio" value={serviceName} />}
        {subject && <InfoRow label="Asunto" value={subject} />}
        <InfoRow label="Tu mensaje" value={message} />
      </Section>
      <Text style={footnote}>
        Si es urgente, podés llamarnos al 3433020527 durante el horario de atención.
      </Text>
    </Layout>
  )
}

FormSubmissionReceipt.PreviewProps = {
  name: 'María López',
  subject: 'Consulta sobre análisis hormonales',
  message:
    'Hola, quería saber si los análisis hormonales se hacen con ayuno y qué obras sociales cubren el estudio.',
  serviceName: 'Clínica Humana',
} satisfies FormSubmissionReceiptProps

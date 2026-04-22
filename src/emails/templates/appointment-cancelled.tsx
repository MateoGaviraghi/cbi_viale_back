import { Link, Section, Text } from '@react-email/components'
import { InfoRow } from './components/InfoRow'
import { Layout } from './components/Layout'
import { footnote, headingDanger, infoBox, link, paragraph } from './styles'
import { formatDateArg, toDate } from './utils'

export interface AppointmentCancelledProps {
  patient: string
  service: string
  date: Date | string
  reason?: string | null
}

export default function AppointmentCancelled({
  patient,
  service,
  date,
  reason = null,
}: AppointmentCancelledProps) {
  const formatted = formatDateArg(toDate(date))
  const preview = `Tu turno de ${service} fue cancelado`

  return (
    <Layout preview={preview}>
      <Text style={headingDanger}>Tu turno fue cancelado</Text>
      <Text style={paragraph}>
        Hola {patient}, te informamos que el siguiente turno fue cancelado.
      </Text>
      <Section style={infoBox}>
        <InfoRow label="Servicio" value={service} />
        <InfoRow label="Fecha y hora" value={formatted} />
        {reason && <InfoRow label="Motivo" value={reason} />}
      </Section>
      <Text style={footnote}>
        Si querés reprogramar, escribinos por{' '}
        <Link href="https://wa.me/543433020527" style={link}>
          WhatsApp
        </Link>
        .
      </Text>
    </Layout>
  )
}

AppointmentCancelled.PreviewProps = {
  patient: 'Juan Pérez',
  service: 'Clínica Humana',
  date: '2026-05-04T12:00:00.000Z',
  reason: 'Paciente avisó por teléfono',
} satisfies AppointmentCancelledProps

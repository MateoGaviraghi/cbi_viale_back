import { Link, Section, Text } from '@react-email/components'
import { InfoRow } from './components/InfoRow'
import { Layout } from './components/Layout'
import { footnote, heading, infoBox, link, paragraph } from './styles'
import { formatDateArg, toDate } from './utils'

export interface AppointmentReminder24hProps {
  patient: string
  service: string
  date: Date | string
}

export default function AppointmentReminder24h({
  patient,
  service,
  date,
}: AppointmentReminder24hProps) {
  const formatted = formatDateArg(toDate(date))
  const preview = `Recordatorio — ${service} mañana`

  return (
    <Layout preview={preview}>
      <Text style={heading}>Te esperamos mañana</Text>
      <Text style={paragraph}>
        Hola {patient}, te recordamos que tenés un turno agendado en CBI Viale dentro
        de las próximas 24 horas.
      </Text>
      <Section style={infoBox}>
        <InfoRow label="Servicio" value={service} />
        <InfoRow label="Fecha y hora" value={formatted} />
      </Section>
      <Text style={footnote}>
        Si no podés asistir, avisanos con tiempo por{' '}
        <Link href="https://wa.me/543433020527" style={link}>
          WhatsApp
        </Link>
        {' '}así liberamos el turno para otra persona.
      </Text>
    </Layout>
  )
}

AppointmentReminder24h.PreviewProps = {
  patient: 'Juan Pérez',
  service: 'Clínica Humana',
  date: '2026-05-04T12:00:00.000Z',
} satisfies AppointmentReminder24hProps

import { Link, Section, Text } from '@react-email/components'
import { InfoRow } from './components/InfoRow'
import { Layout } from './components/Layout'
import { footnote, heading, infoBox, link, paragraph } from './styles'
import { formatDateArg, toDate } from './utils'

export interface AppointmentConfirmationProps {
  patient: string
  service: string
  date: Date | string
  reprogrammed?: boolean
  oldDate?: Date | string | null
}

export default function AppointmentConfirmation({
  patient,
  service,
  date,
  reprogrammed = false,
  oldDate = null,
}: AppointmentConfirmationProps) {
  const formatted = formatDateArg(toDate(date))
  const oldFormatted = oldDate ? formatDateArg(toDate(oldDate)) : null
  const title = reprogrammed ? 'Tu turno fue reprogramado' : 'Tu turno fue registrado'
  const preview = `${title} — ${service}, ${formatted}`

  return (
    <Layout preview={preview}>
      <Text style={heading}>{title}</Text>
      <Text style={paragraph}>
        Hola {patient}, te confirmamos los datos de tu turno en CBI Viale.
      </Text>
      <Section style={infoBox}>
        <InfoRow label="Servicio" value={service} />
        <InfoRow label="Fecha y hora" value={formatted} />
        {oldFormatted && (
          <InfoRow label="Fecha anterior" value={oldFormatted} strikethrough />
        )}
      </Section>
      <Text style={footnote}>
        Para cancelar o reprogramar, escribinos por{' '}
        <Link href="https://wa.me/543433020527" style={link}>
          WhatsApp
        </Link>{' '}
        o respondé este email.
      </Text>
    </Layout>
  )
}

// Fixtures para `npx email dev` en localhost:3010
AppointmentConfirmation.PreviewProps = {
  patient: 'Juan Pérez',
  service: 'Clínica Humana',
  date: '2026-05-04T12:00:00.000Z',
  reprogrammed: false,
} satisfies AppointmentConfirmationProps

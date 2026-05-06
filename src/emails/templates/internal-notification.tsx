import { Section, Text } from '@react-email/components'
import { InfoRow } from './components/InfoRow'
import { Layout } from './components/Layout'
import { eyebrow, heading, infoBox, paragraph } from './styles'
import { formatDateArg, toDate } from './utils'

/**
 * Notificación interna al negocio. Dos variantes:
 *  - `appointment`: llega cuando un paciente crea un turno desde el sitio.
 *  - `submission`: llega cuando alguien envía un formulario de contacto/consulta.
 */
export type InternalNotificationProps =
  | {
      variant: 'appointment'
      service: string
      patient: string
      dni: string
      email: string
      phone: string
      date: Date | string
    }
  | {
      variant: 'submission'
      formType: string
      name: string
      email: string
      phone?: string | null
      subject?: string | null
      message: string
      serviceName?: string | null
    }

export default function InternalNotification(props: InternalNotificationProps) {
  if (props.variant === 'appointment') {
    const formatted = formatDateArg(toDate(props.date))
    const preview = `Nuevo turno — ${props.service} · ${props.patient}`
    return (
      <Layout preview={preview}>
        <Text style={eyebrow}>Nuevo turno · Interno</Text>
        <Text style={heading}>Nuevo turno agendado</Text>
        <Text style={paragraph}>
          Un paciente reservó un turno desde el sitio. Datos:
        </Text>
        <Section style={infoBox}>
          <InfoRow label="Servicio" value={props.service} />
          <InfoRow label="Fecha y hora" value={formatted} />
          <InfoRow label="Paciente" value={props.patient} />
          <InfoRow label="DNI" value={props.dni} />
          <InfoRow label="Email" value={props.email} />
          <InfoRow label="Teléfono" value={props.phone} />
        </Section>
      </Layout>
    )
  }

  const preview = `Nueva consulta — ${props.formType} · ${props.name}`
  return (
    <Layout preview={preview}>
      <Text style={eyebrow}>Nueva consulta · Interno</Text>
      <Text style={heading}>Nueva consulta desde el sitio</Text>
      <Text style={paragraph}>
        Recibimos un formulario de contacto. Datos:
      </Text>
      <Section style={infoBox}>
        <InfoRow label="Tipo" value={props.formType} />
        {props.serviceName && <InfoRow label="Servicio" value={props.serviceName} />}
        <InfoRow label="Nombre" value={props.name} />
        <InfoRow label="Email" value={props.email} />
        {props.phone && <InfoRow label="Teléfono" value={props.phone} />}
        {props.subject && <InfoRow label="Asunto" value={props.subject} />}
        <InfoRow label="Mensaje" value={props.message} />
      </Section>
    </Layout>
  )
}

// Preview default — variant appointment (la variante submission la iteran cuando B-2 llegue)
InternalNotification.PreviewProps = {
  variant: 'appointment',
  service: 'Clínica Humana',
  patient: 'Juan Pérez',
  dni: '12345678',
  email: 'juan@example.com',
  phone: '+543434567890',
  date: '2026-05-04T12:00:00.000Z',
} satisfies InternalNotificationProps

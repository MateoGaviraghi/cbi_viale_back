import { Section, Text } from '@react-email/components'
import { infoLabel, infoValue, infoValueStrike } from '../styles'

interface InfoRowProps {
  label: string
  value: string
  strikethrough?: boolean
}

export function InfoRow({ label, value, strikethrough = false }: InfoRowProps) {
  return (
    <Section style={{ marginBottom: '12px' }}>
      <Text style={infoLabel}>{label}</Text>
      <Text style={strikethrough ? infoValueStrike : infoValue}>{value}</Text>
    </Section>
  )
}

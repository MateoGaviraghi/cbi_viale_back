import type { CSSProperties } from 'react'

// Paleta CBI — ciencia + cuidado (cyan + slate)
export const colors = {
  brand: '#0e7490',
  brandSoft: '#0891b2',
  text: '#0f172a',
  textSoft: '#334155',
  textMuted: '#64748b',
  textFooter: '#94a3b8',
  danger: '#b91c1c',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  bg: '#f6f9fc',
  border: '#e2e8f0',
} as const

export const main: CSSProperties = {
  backgroundColor: colors.bg,
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  padding: '40px 20px',
  margin: 0,
}

export const container: CSSProperties = {
  backgroundColor: colors.surface,
  borderRadius: '8px',
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px',
}

export const brand: CSSProperties = {
  color: colors.brand,
  margin: 0,
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
}

export const tagline: CSSProperties = {
  color: colors.textMuted,
  margin: '4px 0 0',
  fontSize: '14px',
  fontStyle: 'italic',
}

export const divider: CSSProperties = {
  borderColor: colors.border,
  margin: '24px 0',
}

export const heading: CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: colors.text,
  margin: '0 0 8px',
}

export const headingDanger: CSSProperties = {
  ...heading,
  color: colors.danger,
}

export const paragraph: CSSProperties = {
  fontSize: '15px',
  color: colors.textSoft,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const infoBox: CSSProperties = {
  backgroundColor: colors.surfaceAlt,
  padding: '20px',
  borderRadius: '6px',
  border: `1px solid ${colors.border}`,
}

export const infoLabel: CSSProperties = {
  color: colors.textMuted,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 4px',
}

export const infoValue: CSSProperties = {
  color: colors.text,
  fontSize: '15px',
  fontWeight: 500,
  margin: 0,
}

export const infoValueStrike: CSSProperties = {
  ...infoValue,
  textDecoration: 'line-through',
  color: colors.textFooter,
}

export const footnote: CSSProperties = {
  fontSize: '14px',
  color: colors.textMuted,
  lineHeight: '1.6',
  margin: '24px 0 0',
}

export const footerLine: CSSProperties = {
  color: colors.textFooter,
  fontSize: '12px',
  lineHeight: '1.5',
  margin: 0,
}

export const link: CSSProperties = {
  color: colors.brand,
  textDecoration: 'underline',
}

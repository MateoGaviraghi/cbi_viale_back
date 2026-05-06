import type { CSSProperties } from 'react'

/**
 * Paleta y tipografía espejo del design system del sitio CBI Viale.
 * Mantiene los tokens del front (gold/beige/ink, border-radius 0,
 * sin sombras, tipografía Inter + Fraunces).
 *
 * En email usamos fallbacks "web safe": Georgia para serif (sustituye Fraunces),
 * Helvetica/Arial para sans (sustituye Inter). Garantiza render consistente
 * en Outlook, Gmail y clientes que no permiten fuentes web.
 */
export const colors = {
  brand: '#8A6D3F', // gold-700
  brandSoft: '#A88958', // gold más claro
  text: '#1A1A1A', // ink
  textSoft: '#3D3D3D',
  textMuted: '#6B6B6B', // ink-muted
  textFooter: '#9A9A9A',
  danger: '#B8401F',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F0E8', // beige
  bg: '#FAFAF7', // off-white cálido
  border: '#E5DED1', // line
} as const

const fontSans = 'Helvetica, "Helvetica Neue", Arial, sans-serif'
const fontSerif = 'Georgia, "Times New Roman", Times, serif'

export const main: CSSProperties = {
  backgroundColor: colors.bg,
  fontFamily: fontSans,
  padding: '40px 20px',
  margin: 0,
  color: colors.text,
}

export const container: CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 0,
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px',
}

export const brand: CSSProperties = {
  color: colors.text,
  margin: 0,
  fontFamily: fontSerif,
  fontSize: '28px',
  fontWeight: 400,
  letterSpacing: '-0.02em',
  lineHeight: 1.1,
}

export const brandItalic: CSSProperties = {
  color: colors.brand,
  fontStyle: 'italic',
  fontFamily: fontSerif,
}

export const tagline: CSSProperties = {
  color: colors.textMuted,
  margin: '8px 0 0',
  fontSize: '13px',
  fontStyle: 'italic',
  fontFamily: fontSerif,
  letterSpacing: '0.01em',
}

export const eyebrow: CSSProperties = {
  fontFamily: fontSans,
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
  color: colors.brand,
  margin: '0 0 12px',
}

export const divider: CSSProperties = {
  borderColor: colors.border,
  margin: '32px 0',
  borderTopWidth: '1px',
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  borderRightWidth: 0,
}

export const heading: CSSProperties = {
  fontFamily: fontSerif,
  fontSize: '28px',
  fontWeight: 400,
  color: colors.text,
  margin: '0 0 16px',
  lineHeight: 1.15,
  letterSpacing: '-0.01em',
}

export const headingDanger: CSSProperties = {
  ...heading,
  color: colors.danger,
}

export const paragraph: CSSProperties = {
  fontFamily: fontSans,
  fontSize: '15px',
  color: colors.textSoft,
  lineHeight: '1.7',
  margin: '0 0 24px',
}

export const infoBox: CSSProperties = {
  backgroundColor: colors.surfaceAlt,
  padding: '24px',
  borderRadius: 0,
  border: `1px solid ${colors.border}`,
}

export const infoLabel: CSSProperties = {
  color: colors.brand,
  fontFamily: fontSans,
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
  margin: '0 0 6px',
}

export const infoValue: CSSProperties = {
  color: colors.text,
  fontFamily: fontSans,
  fontSize: '15px',
  fontWeight: 400,
  margin: 0,
  lineHeight: '1.55',
}

export const infoValueStrike: CSSProperties = {
  ...infoValue,
  textDecoration: 'line-through',
  color: colors.textFooter,
}

export const footnote: CSSProperties = {
  fontFamily: fontSans,
  fontSize: '13px',
  color: colors.textMuted,
  lineHeight: '1.7',
  margin: '32px 0 0',
}

export const footerLine: CSSProperties = {
  fontFamily: fontSans,
  color: colors.textFooter,
  fontSize: '12px',
  lineHeight: '1.6',
  margin: 0,
  letterSpacing: '0.02em',
}

export const link: CSSProperties = {
  color: colors.brand,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

export const goldRule: CSSProperties = {
  display: 'inline-block',
  width: '32px',
  height: '1px',
  backgroundColor: colors.brand,
  border: 'none',
  margin: '0 12px 4px 0',
  verticalAlign: 'middle',
}

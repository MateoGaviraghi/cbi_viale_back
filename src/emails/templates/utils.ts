export function toDate(d: Date | string | null | undefined): Date {
  if (d instanceof Date) return d
  if (typeof d === 'string') return new Date(d)
  return new Date()
}

/**
 * Formato local argentino con tz explícita: "Lunes 4 de mayo de 2026, 09:00".
 * Usa Intl con timeZone America/Argentina/Buenos_Aires para ser robusto al
 * tz del proceso (Node en Railway corre en UTC).
 */
export function formatDateArg(d: Date): string {
  const formatted = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(d)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

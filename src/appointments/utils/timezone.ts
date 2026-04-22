import type { Weekday } from '@prisma/client'

/**
 * CBI opera en Argentina (UTC-3 fijo — sin DST desde 2009).
 * NO usar el tz del proceso (Railway corre en UTC). Todas las reglas de
 * disponibilidad y los turnos se expresan en hora local argentina, y se
 * convierten a UTC al persistir / comparar contra DB.
 */
export const CBI_TZ_OFFSET_HOURS = -3

/**
 * Convierte fecha + hora LOCAL argentina a un Date UTC.
 * Ej: localArgToUtc(2026, 5, 10, 7, 0) → 2026-05-10T10:00:00.000Z
 */
export function localArgToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hours: number,
  minutes: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hours - CBI_TZ_OFFSET_HOURS, minutes, 0, 0))
}

/**
 * Extrae los componentes LOCALES argentinos de un Date UTC.
 * No depende del tz del proceso — hace la conversión con la constante fija.
 */
export function utcToLocalArgParts(date: Date): {
  year: number
  month: number // 1-12
  day: number
  weekday: number // 0=Sunday..6=Saturday
  hours: number
  minutes: number
} {
  const shifted = new Date(date.getTime() + CBI_TZ_OFFSET_HOURS * 60 * 60 * 1000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  }
}

export function parseTimeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':')
  return Number(parts[0]) * 60 + Number(parts[1])
}

export function minutesToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Mapeo getUTCDay() (0=Sun..6=Sat) → enum Prisma Weekday
const JS_WEEKDAY_TO_PRISMA: readonly Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

export function jsWeekdayToPrisma(weekday: number): Weekday {
  const w = JS_WEEKDAY_TO_PRISMA[weekday]
  if (!w) throw new Error(`Weekday inválido: ${weekday}`)
  return w
}

/** Último día del mes (1-31) en calendario gregoriano. */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Appointment } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { AvailabilityService } from '../availability/availability.service'
import type { PaginatedResponse } from '../availability/availability.service'
import type { Env } from '../config/env.schema'
import { EmailsService } from '../emails/emails.service'
import { PrismaService } from '../prisma/prisma.service'
import { ServicesService } from '../services/services.service'
import type { AppointmentFiltersDto } from './dto/appointment-filters.dto'
import type { CancelAppointmentDto } from './dto/cancel-appointment.dto'
import type { CreateAppointmentDto } from './dto/create-appointment.dto'
import type { ReprogramAppointmentDto } from './dto/reprogram-appointment.dto'
import type { UpdateAppointmentDto } from './dto/update-appointment.dto'
import {
  jsWeekdayToPrisma,
  lastDayOfMonth,
  localArgToUtc,
  minutesToHhmm,
  parseTimeToMinutes,
  utcToLocalArgParts,
} from './utils/timezone'

// Margen de 5 min para evitar rechazar turnos al límite por clock skew entre front/back.
const FUTURE_MARGIN_MS = 5 * 60 * 1000

export interface MonthlyAvailability {
  serviceSlug: string
  durationMinutes: number
  month: string
  days: Array<{ date: string; slots: string[] }>
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly availability: AvailabilityService,
    private readonly emails: EmailsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ============================================================================
  //  Disponibilidad mensual (público)
  // ============================================================================

  /**
   * Algoritmo de slots para un mes.
   *  1. Reglas efectivas del servicio (override semántico — específicas reemplazan globales).
   *  2. Bloqueos en el rango del mes.
   *  3. Turnos activos (PENDING/CONFIRMED) del mes → Set de timestamps ocupados.
   *  4. Iterar día por día en hora local ARG:
   *       · skip si el día cae en un BlockedDate
   *       · para cada rule del weekday: generar ticks cada durationMinutes
   *       · descartar slots pasados y ocupados
   *  5. Devolver array de días (incluye días vacíos para calendario completo).
   */
  async getMonthlyAvailability(
    serviceSlug: string,
    month: string,
  ): Promise<MonthlyAvailability> {
    const service = await this.services.findBySlugOrThrow(serviceSlug)
    const [yearStr, monthStr] = month.split('-')
    const year = Number(yearStr)
    const mo = Number(monthStr)
    const lastDay = lastDayOfMonth(year, mo)

    // Rango completo del mes en UTC (a partir de local ARG)
    const monthStartUtc = localArgToUtc(year, mo, 1, 0, 0)
    const monthEndUtc = localArgToUtc(year, mo, lastDay, 23, 59)

    const [rules, blocks, taken] = await Promise.all([
      this.availability.getEffectiveRulesForService(service.id),
      this.availability.getBlockedDatesInRange(monthStartUtc, monthEndUtc, service.id),
      this.prisma.appointment.findMany({
        where: {
          serviceId: service.id,
          date: { gte: monthStartUtc, lte: monthEndUtc },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { date: true },
      }),
    ])

    const takenSet = new Set(taken.map((a) => a.date.getTime()))
    const now = Date.now()
    const days: MonthlyAvailability['days'] = []

    for (let day = 1; day <= lastDay; day++) {
      const dayStartUtc = localArgToUtc(year, mo, day, 0, 0)
      const dayEndUtc = localArgToUtc(year, mo, day, 23, 59)
      const dateStr = `${year}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      const isBlocked = blocks.some(
        (b) => b.startDate <= dayEndUtc && b.endDate >= dayStartUtc,
      )
      if (isBlocked) {
        days.push({ date: dateStr, slots: [] })
        continue
      }

      const weekdayPrisma = jsWeekdayToPrisma(utcToLocalArgParts(dayStartUtc).weekday)
      const dayRules = rules.filter((r) => r.weekday === weekdayPrisma)
      const slots: string[] = []

      for (const rule of dayRules) {
        const startMin = parseTimeToMinutes(rule.startTime)
        const endMin = parseTimeToMinutes(rule.endTime)
        for (
          let m = startMin;
          m + service.durationMinutes <= endMin;
          m += service.durationMinutes
        ) {
          const hh = Math.floor(m / 60)
          const mm = m % 60
          const slotUtc = localArgToUtc(year, mo, day, hh, mm)
          const ts = slotUtc.getTime()
          if (ts <= now) continue
          if (takenSet.has(ts)) continue
          slots.push(minutesToHhmm(m))
        }
      }

      slots.sort()
      days.push({ date: dateStr, slots })
    }

    return { serviceSlug, durationMinutes: service.durationMinutes, month, days }
  }

  // ============================================================================
  //  Crear turno (público)
  // ============================================================================

  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    const service = await this.services.findBySlugOrThrow(dto.serviceSlug)

    if (service.requiresConsent && dto.consentGiven !== true) {
      throw new BadRequestException(
        'Este servicio requiere consentimiento explícito (consentGiven: true)',
      )
    }

    await this.validateSlot(service.id, dto.date, service.durationMinutes)

    // Transacción serializable: chequeo de conflicto + create atomizados.
    const appointment = await this.prisma.$transaction(
      async (tx) => {
        const conflict = await tx.appointment.findFirst({
          where: {
            serviceId: service.id,
            date: dto.date,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          select: { id: true },
        })
        if (conflict) throw new ConflictException('Ese turno ya fue tomado por otro paciente')

        return tx.appointment.create({
          data: {
            serviceId: service.id,
            date: dto.date,
            durationMin: service.durationMinutes,
            status: 'PENDING',
            patientName: dto.patientName,
            patientDni: dto.patientDni,
            patientEmail: dto.patientEmail,
            patientPhone: dto.patientPhone,
            notes: dto.notes ?? null,
            consentGiven: dto.consentGiven ?? false,
          },
        })
      },
      { isolationLevel: 'Serializable' },
    )

    // Emails fuera de la transacción — no bloquean el response.
    // `appointmentId` va en el top-level de EnqueueParams (para EmailLog),
    // NO en el payload (el template no lo consume).
    await this.emails.enqueue({
      kind: 'APPOINTMENT_CONFIRMATION',
      to: appointment.patientEmail,
      subject: `Turno registrado — ${service.name} · CBI Viale`,
      appointmentId: appointment.id,
      payload: {
        service: service.name,
        date: appointment.date,
        patient: appointment.patientName,
      },
    })

    const businessEmail = this.config.get('BUSINESS_NOTIFICATION_EMAIL', { infer: true })
    if (businessEmail) {
      await this.emails.enqueue({
        kind: 'INTERNAL_NOTIFICATION',
        to: businessEmail,
        subject: `Nuevo turno — ${service.name}`,
        appointmentId: appointment.id,
        payload: {
          variant: 'appointment',
          service: service.name,
          patient: appointment.patientName,
          dni: appointment.patientDni,
          email: appointment.patientEmail,
          phone: appointment.patientPhone,
          date: appointment.date,
        },
      })
    }

    // NOTA: no se audita la creación pública porque AuditLog.userId es required
    // con FK a User. El registro se reconstruye via Appointment.createdAt + EmailLog.
    // Cuando exista un usuario SYSTEM en seed, podemos auditar también publics.
    return appointment
  }

  // ============================================================================
  //  Admin
  // ============================================================================

  async list(filters: AppointmentFiltersDto): Promise<PaginatedResponse<Appointment>> {
    const where: Prisma.AppointmentWhereInput = {}
    if (filters.status) where.status = filters.status
    if (filters.dateFrom || filters.dateTo) {
      const range: Prisma.DateTimeFilter = {}
      if (filters.dateFrom) range.gte = filters.dateFrom
      if (filters.dateTo) range.lte = filters.dateTo
      where.date = range
    }
    if (filters.serviceSlug) {
      const svc = await this.services.findBySlugOrThrow(filters.serviceSlug)
      where.serviceId = svc.id
    }
    if (filters.q) {
      where.OR = [
        { patientName: { contains: filters.q, mode: 'insensitive' } },
        { patientDni: { contains: filters.q } },
        { patientEmail: { contains: filters.q, mode: 'insensitive' } },
        { patientPhone: { contains: filters.q } },
      ]
    }

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: { service: { select: { id: true, slug: true, name: true } } },
      }),
      this.prisma.appointment.count({ where }),
    ])

    return {
      data: items,
      meta: {
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    }
  }

  async getByIdOrThrow(id: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true },
    })
    if (!appt) throw new NotFoundException('Turno no encontrado')
    return appt
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    userId: string,
  ): Promise<Appointment> {
    const existing = await this.prisma.appointment.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Turno no encontrado')

    const data: Prisma.AppointmentUpdateInput = {}
    if (dto.notes !== undefined) data.notes = dto.notes ?? null
    if (dto.status !== undefined) {
      data.status = dto.status
      // CONFIRMED setea confirmedAt automáticamente si no estaba seteado.
      if (dto.status === 'CONFIRMED' && !existing.confirmedAt) {
        data.confirmedAt = new Date()
      }
    }

    const updated = await this.prisma.appointment.update({ where: { id }, data })
    await this.audit(userId, 'APPOINTMENT_PATCH', 'Appointment', id, { changes: dto })
    return updated
  }

  async cancel(
    id: string,
    dto: CancelAppointmentDto,
    userId: string,
  ): Promise<Appointment> {
    const existing = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true },
    })
    if (!existing) throw new NotFoundException('Turno no encontrado')
    if (existing.status === 'CANCELLED') {
      throw new ConflictException('El turno ya está cancelado')
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.cancelReason ?? null,
      },
    })

    await this.emails.enqueue({
      kind: 'APPOINTMENT_CANCELLED',
      to: existing.patientEmail,
      subject: `Turno cancelado — ${existing.service.name} · CBI Viale`,
      appointmentId: id,
      payload: {
        service: existing.service.name,
        date: existing.date,
        patient: existing.patientName,
        reason: dto.cancelReason ?? null,
      },
    })

    await this.audit(userId, 'APPOINTMENT_CANCEL', 'Appointment', id, {
      cancelReason: dto.cancelReason,
      previousStatus: existing.status,
    })
    return updated
  }

  async reprogram(
    id: string,
    dto: ReprogramAppointmentDto,
    userId: string,
  ): Promise<Appointment> {
    const existing = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true },
    })
    if (!existing) throw new NotFoundException('Turno no encontrado')
    if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Solo se pueden reprogramar turnos en estado PENDING o CONFIRMED',
      )
    }

    await this.validateSlot(existing.serviceId, dto.date, existing.durationMin)

    const oldDate = existing.date
    const updated = await this.prisma.$transaction(
      async (tx) => {
        const conflict = await tx.appointment.findFirst({
          where: {
            serviceId: existing.serviceId,
            date: dto.date,
            status: { in: ['PENDING', 'CONFIRMED'] },
            NOT: { id },
          },
          select: { id: true },
        })
        if (conflict) throw new ConflictException('El nuevo slot ya está ocupado')
        return tx.appointment.update({ where: { id }, data: { date: dto.date } })
      },
      { isolationLevel: 'Serializable' },
    )

    // Reusamos APPOINTMENT_CONFIRMATION con flag reprogrammed en payload.
    // El template consume `date` (nueva fecha) + `oldDate` (previa) + `reprogrammed: true`.
    // `newDate` no existe como prop — el TS narrowing nos lo hubiera marcado antes.
    await this.emails.enqueue({
      kind: 'APPOINTMENT_CONFIRMATION',
      to: existing.patientEmail,
      subject: `Turno reprogramado — ${existing.service.name} · CBI Viale`,
      appointmentId: id,
      payload: {
        service: existing.service.name,
        date: dto.date,
        oldDate,
        patient: existing.patientName,
        reprogrammed: true,
      },
    })

    await this.audit(userId, 'APPOINTMENT_REPROGRAM', 'Appointment', id, {
      oldDate,
      newDate: dto.date,
    })
    return updated
  }

  // ============================================================================
  //  Validación de slot (usada por create y reprogram)
  // ============================================================================

  /**
   * Valida que la fecha:
   *  (a) sea futura (con margen de clock skew)
   *  (b) caiga exactamente en un tick (startMin + k*duration) de una rule efectiva
   *  (c) no esté dentro de un BlockedDate
   * No chequea colisión con otros turnos — eso se hace dentro de la transacción.
   */
  private async validateSlot(
    serviceId: string,
    slotUtc: Date,
    durationMinutes: number,
  ): Promise<void> {
    const ts = slotUtc.getTime()
    if (ts <= Date.now() + FUTURE_MARGIN_MS) {
      throw new BadRequestException('El turno debe agendarse a futuro')
    }

    const parts = utcToLocalArgParts(slotUtc)
    const weekdayPrisma = jsWeekdayToPrisma(parts.weekday)
    const slotLocalMin = parts.hours * 60 + parts.minutes

    const rules = await this.availability.getEffectiveRulesForService(serviceId)
    const match = rules.find((r) => {
      if (r.weekday !== weekdayPrisma) return false
      if (!r.active) return false
      const startMin = parseTimeToMinutes(r.startTime)
      const endMin = parseTimeToMinutes(r.endTime)
      if (slotLocalMin < startMin) return false
      if (slotLocalMin + durationMinutes > endMin) return false
      return (slotLocalMin - startMin) % durationMinutes === 0
    })
    if (!match) {
      throw new BadRequestException(
        'No hay disponibilidad en ese horario para este servicio',
      )
    }

    const blocked = await this.availability.isDateBlockedForService(slotUtc, serviceId)
    if (blocked) {
      throw new BadRequestException('Ese día está bloqueado')
    }
  }

  private async audit(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { userId, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue },
    })
  }
}

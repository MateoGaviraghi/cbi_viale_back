import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { AvailabilityRule, BlockedDate, Weekday } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ServicesService } from '../services/services.service'
import type {
  BlockedDateFiltersDto,
  RuleFiltersDto,
} from './dto/availability-filters.dto'
import type { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto'
import type { CreateBlockedDateDto } from './dto/create-blocked-date.dto'
import type { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto'
import type { UpdateBlockedDateDto } from './dto/update-blocked-date.dto'

export interface PaginatedResponse<T> {
  data: T[]
  meta: { total: number; page: number; pageSize: number; totalPages: number }
}

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  // ============================================================================
  //  AvailabilityRule — CRUD admin
  // ============================================================================

  async listRules(filters: RuleFiltersDto): Promise<PaginatedResponse<AvailabilityRule>> {
    const where: Prisma.AvailabilityRuleWhereInput = {}
    if (filters.weekday) where.weekday = filters.weekday
    if (filters.active !== undefined) where.active = filters.active
    if (filters.serviceSlug) {
      const svc = await this.services.findBySlugOrThrow(filters.serviceSlug)
      where.serviceId = svc.id
    }

    const [items, total] = await Promise.all([
      this.prisma.availabilityRule.findMany({
        where,
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.availabilityRule.count({ where }),
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

  async createRule(dto: CreateAvailabilityRuleDto, userId: string): Promise<AvailabilityRule> {
    this.validateTimeRange(dto.startTime, dto.endTime)
    const serviceId = dto.serviceId ?? null
    if (serviceId) await this.ensureServiceExists(serviceId)

    await this.checkRuleOverlap({
      weekday: dto.weekday,
      serviceId,
      startTime: dto.startTime,
      endTime: dto.endTime,
    })

    const rule = await this.prisma.availabilityRule.create({
      data: {
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        serviceId,
        active: dto.active ?? true,
      },
    })

    await this.audit(userId, 'AVAILABILITY_RULE_CREATE', 'AvailabilityRule', rule.id, {
      weekday: rule.weekday,
      startTime: rule.startTime,
      endTime: rule.endTime,
      serviceId: rule.serviceId,
    })

    return rule
  }

  async updateRule(
    id: string,
    dto: UpdateAvailabilityRuleDto,
    userId: string,
  ): Promise<AvailabilityRule> {
    const existing = await this.prisma.availabilityRule.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Regla de disponibilidad no encontrada')

    const nextStart = dto.startTime ?? existing.startTime
    const nextEnd = dto.endTime ?? existing.endTime
    this.validateTimeRange(nextStart, nextEnd)

    const nextServiceId =
      dto.serviceId !== undefined ? (dto.serviceId ?? null) : existing.serviceId
    if (nextServiceId) await this.ensureServiceExists(nextServiceId)

    await this.checkRuleOverlap({
      weekday: dto.weekday ?? existing.weekday,
      serviceId: nextServiceId,
      startTime: nextStart,
      endTime: nextEnd,
      excludeId: id,
    })

    const rule = await this.prisma.availabilityRule.update({
      where: { id },
      data: {
        ...(dto.weekday !== undefined && { weekday: dto.weekday }),
        ...(dto.startTime !== undefined && { startTime: dto.startTime }),
        ...(dto.endTime !== undefined && { endTime: dto.endTime }),
        ...(dto.serviceId !== undefined && { serviceId: dto.serviceId ?? null }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    })

    await this.audit(userId, 'AVAILABILITY_RULE_UPDATE', 'AvailabilityRule', rule.id, {
      changes: dto,
    })
    return rule
  }

  async deleteRule(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.availabilityRule.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Regla de disponibilidad no encontrada')
    await this.prisma.availabilityRule.delete({ where: { id } })
    await this.audit(userId, 'AVAILABILITY_RULE_DELETE', 'AvailabilityRule', id, {
      weekday: existing.weekday,
      startTime: existing.startTime,
      endTime: existing.endTime,
      serviceId: existing.serviceId,
    })
  }

  // ============================================================================
  //  BlockedDate — CRUD admin
  // ============================================================================

  async listBlockedDates(
    filters: BlockedDateFiltersDto,
  ): Promise<PaginatedResponse<BlockedDate>> {
    const where: Prisma.BlockedDateWhereInput = {}
    if (filters.from) where.endDate = { gte: filters.from }
    if (filters.to) where.startDate = { lte: filters.to }
    if (filters.serviceSlug) {
      const svc = await this.services.findBySlugOrThrow(filters.serviceSlug)
      where.serviceId = svc.id
    }

    const [items, total] = await Promise.all([
      this.prisma.blockedDate.findMany({
        where,
        orderBy: { startDate: 'asc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.blockedDate.count({ where }),
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

  async createBlockedDate(dto: CreateBlockedDateDto, userId: string): Promise<BlockedDate> {
    this.validateDateRange(dto.startDate, dto.endDate)
    const serviceId = dto.serviceId ?? null
    if (serviceId) await this.ensureServiceExists(serviceId)

    // No bloquea la operación — pero dejamos traza del impacto en turnos ya tomados.
    const affectedAppointments = await this.prisma.appointment.count({
      where: {
        date: { gte: dto.startDate, lte: dto.endDate },
        status: { in: ['PENDING', 'CONFIRMED'] },
        ...(serviceId && { serviceId }),
      },
    })
    if (affectedAppointments > 0) {
      this.logger.warn(
        `Bloqueo ${dto.startDate.toISOString()}–${dto.endDate.toISOString()} afecta ${affectedAppointments} turnos existentes`,
      )
    }

    const block = await this.prisma.blockedDate.create({
      data: {
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason ?? null,
        serviceId,
        createdBy: userId,
      },
    })

    await this.audit(userId, 'BLOCKED_DATE_CREATE', 'BlockedDate', block.id, {
      startDate: block.startDate,
      endDate: block.endDate,
      reason: block.reason,
      serviceId: block.serviceId,
      affectedAppointments,
    })

    return block
  }

  async updateBlockedDate(
    id: string,
    dto: UpdateBlockedDateDto,
    userId: string,
  ): Promise<BlockedDate> {
    const existing = await this.prisma.blockedDate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Bloqueo no encontrado')

    const nextStart = dto.startDate ?? existing.startDate
    const nextEnd = dto.endDate ?? existing.endDate
    this.validateDateRange(nextStart, nextEnd)

    if (dto.serviceId) await this.ensureServiceExists(dto.serviceId)

    const block = await this.prisma.blockedDate.update({
      where: { id },
      data: {
        ...(dto.startDate !== undefined && { startDate: dto.startDate }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate }),
        ...(dto.reason !== undefined && { reason: dto.reason ?? null }),
        ...(dto.serviceId !== undefined && { serviceId: dto.serviceId ?? null }),
      },
    })

    await this.audit(userId, 'BLOCKED_DATE_UPDATE', 'BlockedDate', block.id, { changes: dto })
    return block
  }

  async deleteBlockedDate(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.blockedDate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Bloqueo no encontrado')
    await this.prisma.blockedDate.delete({ where: { id } })
    await this.audit(userId, 'BLOCKED_DATE_DELETE', 'BlockedDate', id, {
      startDate: existing.startDate,
      endDate: existing.endDate,
      reason: existing.reason,
      serviceId: existing.serviceId,
    })
  }

  // ============================================================================
  //  Lectura pública + helpers internos (consumidos por AppointmentsService)
  // ============================================================================

  /**
   * Endpoint público consumido por el front para pintar el calendario.
   * Devuelve reglas EFECTIVAS (override global/específica) + bloqueos futuros (endDate >= hoy).
   */
  async getPublicAvailability(serviceSlug: string) {
    const service = await this.services.findBySlugOrThrow(serviceSlug)
    const rules = await this.getEffectiveRulesForService(service.id)

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const blockedDates = await this.prisma.blockedDate.findMany({
      where: {
        endDate: { gte: startOfToday },
        OR: [{ serviceId: null }, { serviceId: service.id }],
      },
      orderBy: { startDate: 'asc' },
    })

    return {
      service: {
        slug: serviceSlug,
        name: service.name,
        durationMinutes: service.durationMinutes,
      },
      rules: rules.map((r) => ({
        id: r.id,
        weekday: r.weekday,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
      blockedDates,
    }
  }

  /**
   * Override semántico: si el servicio tiene al menos una rule específica
   * (serviceId = X), se usan ÚNICAMENTE esas. Si no tiene ninguna, caen las globales
   * (serviceId = null). Este contrato es el que consume AppointmentsService para slots.
   */
  async getEffectiveRulesForService(serviceId: string): Promise<AvailabilityRule[]> {
    const specific = await this.prisma.availabilityRule.findMany({
      where: { serviceId, active: true },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    })
    if (specific.length > 0) return specific

    return this.prisma.availabilityRule.findMany({
      where: { serviceId: null, active: true },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    })
  }

  async isDateBlockedForService(date: Date, serviceId: string): Promise<boolean> {
    const count = await this.prisma.blockedDate.count({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
        OR: [{ serviceId: null }, { serviceId }],
      },
    })
    return count > 0
  }

  async getBlockedDatesInRange(
    from: Date,
    to: Date,
    serviceId?: string,
  ): Promise<BlockedDate[]> {
    return this.prisma.blockedDate.findMany({
      where: {
        startDate: { lte: to },
        endDate: { gte: from },
        ...(serviceId ? { OR: [{ serviceId: null }, { serviceId }] } : {}),
      },
      orderBy: { startDate: 'asc' },
    })
  }

  // ============================================================================
  //  Helpers privados
  // ============================================================================

  private parseTimeToMinutes(hhmm: string): number {
    // El DTO ya valida formato HH:MM vía regex, así que acá confiamos.
    const parts = hhmm.split(':')
    return Number(parts[0]) * 60 + Number(parts[1])
  }

  private validateTimeRange(startTime: string, endTime: string): void {
    if (this.parseTimeToMinutes(endTime) <= this.parseTimeToMinutes(startTime)) {
      throw new BadRequestException('endTime debe ser mayor que startTime')
    }
  }

  private validateDateRange(start: Date, end: Date): void {
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('endDate debe ser mayor o igual a startDate')
    }
  }

  /**
   * Overlap dentro del MISMO scope (mismo weekday + mismo serviceId — null incluido).
   * Dos rangos [a1,a2] y [b1,b2] se solapan si a1 < b2 && b1 < a2.
   * Usamos comparación de string porque "HH:MM" zero-padded ordena lexicográficamente.
   */
  private async checkRuleOverlap(params: {
    weekday: Weekday
    serviceId: string | null
    startTime: string
    endTime: string
    excludeId?: string
  }): Promise<void> {
    const conflict = await this.prisma.availabilityRule.findFirst({
      where: {
        weekday: params.weekday,
        serviceId: params.serviceId,
        startTime: { lt: params.endTime },
        endTime: { gt: params.startTime },
        ...(params.excludeId && { NOT: { id: params.excludeId } }),
      },
    })
    if (conflict) {
      throw new ConflictException(
        `Ya existe una regla en ${params.weekday} ${conflict.startTime}–${conflict.endTime} en este scope`,
      )
    }
  }

  private async ensureServiceExists(serviceId: string): Promise<void> {
    const exists = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    })
    if (!exists) throw new NotFoundException(`Servicio con id "${serviceId}" no existe`)
  }

  /**
   * Audit log inline — cuando exista AuditLogModule (Fase 2), refactor a helper compartido.
   */
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

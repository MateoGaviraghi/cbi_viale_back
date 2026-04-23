import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FormSubmission, FormType } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { PaginatedResponse } from '../availability/availability.service'
import type { Env } from '../config/env.schema'
import { EmailsService } from '../emails/emails.service'
import { PrismaService } from '../prisma/prisma.service'
import { ServicesService } from '../services/services.service'
import type { CreateSubmissionDto } from './dto/create-submission.dto'
import type { SubmissionFiltersDto } from './dto/submission-filters.dto'
import type { UpdateSubmissionDto } from './dto/update-submission.dto'

/** JSON stringified máximo para extraData. Evita payloads abusivos. */
const MAX_EXTRA_DATA_BYTES = 10_000

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly emails: EmailsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ============================================================================
  //  Creación pública
  // ============================================================================

  async create(dto: CreateSubmissionDto): Promise<FormSubmission> {
    if (dto.type === 'SERVICE_INQUIRY' && !dto.serviceSlug) {
      throw new BadRequestException('type SERVICE_INQUIRY requiere serviceSlug')
    }

    let serviceId: string | null = null
    let serviceName: string | null = null
    if (dto.serviceSlug) {
      const svc = await this.services.findBySlugOrThrow(dto.serviceSlug)
      serviceId = svc.id
      serviceName = svc.name
    }

    const extraData = dto.extraData ?? {}
    if (JSON.stringify(extraData).length > MAX_EXTRA_DATA_BYTES) {
      throw new BadRequestException('extraData excede el tamaño máximo (10KB stringified)')
    }

    const submission = await this.prisma.formSubmission.create({
      data: {
        type: dto.type,
        serviceId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        subject: dto.subject ?? null,
        message: dto.message,
        extraData: extraData as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    })

    // Receipt al submitter.
    await this.emails.enqueue({
      kind: 'FORM_RECEIPT',
      to: submission.email,
      subject: `Recibimos tu consulta · CBI Viale`,
      payload: {
        name: submission.name,
        subject: submission.subject,
        message: submission.message,
        serviceName,
      },
    })

    // Notificación al negocio — solo si la env var está seteada.
    const businessEmail = this.config.get('BUSINESS_NOTIFICATION_EMAIL', { infer: true })
    if (businessEmail) {
      await this.emails.enqueue({
        kind: 'INTERNAL_NOTIFICATION',
        to: businessEmail,
        subject: `Nueva consulta — ${humanFormType(submission.type)}${serviceName ? ` · ${serviceName}` : ''}`,
        payload: {
          variant: 'submission',
          formType: humanFormType(submission.type),
          name: submission.name,
          email: submission.email,
          phone: submission.phone,
          subject: submission.subject,
          message: submission.message,
          serviceName,
        },
      })
    }

    // No audit log en create público (AuditLog.userId es required + FK a User).
    return submission
  }

  // ============================================================================
  //  Admin
  // ============================================================================

  async list(filters: SubmissionFiltersDto): Promise<PaginatedResponse<FormSubmission>> {
    const where: Prisma.FormSubmissionWhereInput = {}
    if (filters.type) where.type = filters.type
    if (filters.status) where.status = filters.status
    if (filters.serviceSlug) {
      const svc = await this.services.findBySlugOrThrow(filters.serviceSlug)
      where.serviceId = svc.id
    }
    if (filters.dateFrom || filters.dateTo) {
      const range: Prisma.DateTimeFilter = {}
      if (filters.dateFrom) range.gte = filters.dateFrom
      if (filters.dateTo) range.lte = filters.dateTo
      where.createdAt = range
    }
    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
        { subject: { contains: filters.q, mode: 'insensitive' } },
        { message: { contains: filters.q, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: { service: { select: { id: true, slug: true, name: true } } },
      }),
      this.prisma.formSubmission.count({ where }),
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
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id },
      include: { service: true },
    })
    if (!submission) throw new NotFoundException('Consulta no encontrada')
    return submission
  }

  async update(
    id: string,
    dto: UpdateSubmissionDto,
    userId: string,
  ): Promise<FormSubmission> {
    const existing = await this.prisma.formSubmission.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Consulta no encontrada')

    // PATCH vacío → devolvemos existing sin auditar (noop).
    if (dto.status === undefined) return existing

    const data: Prisma.FormSubmissionUpdateInput = { status: dto.status }
    // Primera transición a ANSWERED sella timestamp + autor.
    // Transiciones posteriores a ANSWERED son idempotentes (no re-escriben).
    if (dto.status === 'ANSWERED' && existing.status !== 'ANSWERED') {
      data.answeredAt = new Date()
      data.answeredBy = userId
    }

    const updated = await this.prisma.formSubmission.update({ where: { id }, data })
    await this.audit(userId, 'SUBMISSION_PATCH', 'FormSubmission', id, {
      fromStatus: existing.status,
      toStatus: dto.status,
    })
    return updated
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

/** Traduce el enum FormType a texto legible (usado en subject y body de emails). */
function humanFormType(type: FormType): string {
  switch (type) {
    case 'CONTACT_GENERAL':
      return 'Contacto general'
    case 'SERVICE_INQUIRY':
      return 'Consulta por servicio'
    case 'CONSENT':
      return 'Consentimiento'
    case 'CUSTOM':
      return 'Personalizado'
  }
}

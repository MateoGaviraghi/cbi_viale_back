import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { PaginatedResponse } from '../availability/availability.service'
import { PrismaService } from '../prisma/prisma.service'
import type { AuditLogFiltersDto } from './dto/audit-log-filters.dto'

/** AuditLog + snapshot del usuario que ejecutó la acción (id, name, email). */
export type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: { user: { select: { id: true; name: true; email: true } } }
}>

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listado paginado del audit log (más reciente primero), con el usuario
   * incluido para mostrar quién hizo cada acción. Filtros opcionales por
   * userId / entity / action.
   */
  async list(filters: AuditLogFiltersDto): Promise<PaginatedResponse<AuditLogWithUser>> {
    const where: Prisma.AuditLogWhereInput = {}
    if (filters.userId) where.userId = filters.userId
    if (filters.entity) where.entity = filters.entity
    if (filters.action) where.action = filters.action

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
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
}

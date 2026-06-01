import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { User, UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import type { PaginatedResponse } from '../availability/availability.service'
import type { CreateUserDto } from './dto/create-user.dto'
import type { UpdatePasswordDto } from './dto/update-password.dto'
import type { UpdatePermissionsDto } from './dto/update-permissions.dto'
import type { UpdateUserDto } from './dto/update-user.dto'
import type { UserFiltersDto } from './dto/user-filters.dto'

// Whitelist única de permisos válidos. Cualquier key fuera de acá tira 400 al
// asignar permisos. Mantener sincronizado con los @Permissions() en los demás
// controllers.
const VALID_PERMISSIONS = [
  'manageAppointments',
  'manageAvailability',
  'manageSubmissions',
  'manageUsers',
  'viewAuditLog',
  'exportData',
  'viewAnalytics',
] as const
export type ValidPermission = (typeof VALID_PERMISSIONS)[number]

// Shape público: nunca exponer passwordHash, emailVerified ni image (los dos
// últimos son remanentes de NextAuth, se eliminan en B-4).
export type PublicUser = Omit<User, 'passwordHash' | 'emailVerified' | 'image'>

function toPublicUser(u: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, emailVerified, image, ...rest } = u
  return rest
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  //  Métodos compartidos con AuthModule (no admin)
  // ============================================================================

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Usuario no encontrado')
    return user
  }

  async createUser(params: {
    name: string
    email: string
    password: string
    role?: UserRole
    permissions?: Record<string, boolean>
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(params.password, 10)
    return this.prisma.user.create({
      data: {
        name: params.name,
        email: params.email,
        passwordHash,
        role: params.role ?? 'EMPLOYEE',
        permissions: params.permissions ?? {},
        active: true,
      },
    })
  }

  /** Valida password contra hash. No tira si user no existe (retorna null). */
  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email)
    if (!user || !user.passwordHash || !user.active) return null
    const ok = await bcrypt.compare(password, user.passwordHash)
    return ok ? user : null
  }

  // ============================================================================
  //  Endpoints admin
  // ============================================================================

  async list(filters: UserFiltersDto): Promise<PaginatedResponse<PublicUser>> {
    const where: Prisma.UserWhereInput = {}
    if (filters.role) where.role = filters.role
    if (filters.active !== undefined) where.active = filters.active
    if (filters.q) {
      const q = filters.q.trim()
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ]
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.user.count({ where }),
    ])

    return {
      data: items.map(toPublicUser),
      meta: {
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    }
  }

  async getPublicByIdOrThrow(id: string): Promise<PublicUser> {
    const user = await this.findByIdOrThrow(id)
    return toPublicUser(user)
  }

  async createFromAdmin(dto: CreateUserDto, currentUserId: string): Promise<PublicUser> {
    if (dto.permissions) this.validatePermissionKeys(dto.permissions)

    try {
      const user = await this.createUser({
        name: dto.name,
        email: dto.email,
        password: dto.password,
        role: dto.role,
        permissions: dto.permissions,
      })
      await this.audit(currentUserId, 'USER_CREATE', user.id, {
        email: user.email,
        role: user.role,
      })
      return toPublicUser(user)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // unique constraint en email — AllExceptionsFilter lo manda como 409
        throw e
      }
      throw e
    }
  }

  async updateFromAdmin(
    id: string,
    dto: UpdateUserDto,
    currentUserId: string,
  ): Promise<PublicUser> {
    const target = await this.findByIdOrThrow(id)

    // Self-protection: nadie puede deshabilitarse a sí mismo
    if (dto.active === false && target.id === currentUserId) {
      throw new ForbiddenException('No podés deshabilitar tu propio usuario')
    }

    // Si bajamos a EMPLOYEE o deshabilitamos, chequear que quede al menos un ADMIN activo
    const willLoseAdmin =
      target.role === 'ADMIN' &&
      ((dto.role !== undefined && dto.role !== 'ADMIN') || dto.active === false)
    if (willLoseAdmin) await this.ensureAdminCountAfterChange(target.id)

    const data: Prisma.UserUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.email !== undefined) data.email = dto.email
    if (dto.role !== undefined) data.role = dto.role
    if (dto.active !== undefined) data.active = dto.active

    const updated = await this.prisma.user.update({ where: { id }, data })
    await this.audit(currentUserId, 'USER_UPDATE', id, {
      changedFields: Object.keys(data),
    })
    return toPublicUser(updated)
  }

  async updatePermissionsFromAdmin(
    id: string,
    dto: UpdatePermissionsDto,
    currentUserId: string,
  ): Promise<PublicUser> {
    this.validatePermissionKeys(dto.permissions)
    const target = await this.findByIdOrThrow(id)

    const updated = await this.prisma.user.update({
      where: { id },
      data: { permissions: dto.permissions },
    })
    await this.audit(currentUserId, 'USER_PERMISSIONS_UPDATE', id, {
      before: target.permissions,
      after: dto.permissions,
    })
    return toPublicUser(updated)
  }

  async updatePasswordFromAdmin(
    id: string,
    dto: UpdatePasswordDto,
    currentUserId: string,
  ): Promise<PublicUser> {
    await this.findByIdOrThrow(id)
    const passwordHash = await bcrypt.hash(dto.newPassword, 10)
    const updated = await this.prisma.user.update({
      where: { id },
      // Incrementar tokenVersion invalida los tokens (access + refresh) previos.
      data: { passwordHash, tokenVersion: { increment: 1 } },
    })
    // NUNCA loguear la password en metadata
    await this.audit(currentUserId, 'USER_PASSWORD_RESET', id, {})
    this.logger.warn(`Password reset by ${currentUserId} on user ${id}`)
    return toPublicUser(updated)
  }

  async softDelete(id: string, currentUserId: string): Promise<PublicUser> {
    const target = await this.findByIdOrThrow(id)

    if (target.id === currentUserId) {
      throw new ForbiddenException('No podés deshabilitar tu propio usuario')
    }

    if (target.role === 'ADMIN') await this.ensureAdminCountAfterChange(target.id)

    // Idempotente: si ya está inactive, no audit-loguea para no llenar la tabla
    if (!target.active) return toPublicUser(target)

    const updated = await this.prisma.user.update({
      where: { id },
      // tokenVersion++ corta también las sesiones vigentes del usuario desactivado.
      data: { active: false, tokenVersion: { increment: 1 } },
    })
    await this.audit(currentUserId, 'USER_DELETE', id, { email: target.email })
    return toPublicUser(updated)
  }

  // ============================================================================
  //  Helpers privados
  // ============================================================================

  private validatePermissionKeys(perms: Record<string, boolean>): void {
    const invalid = Object.keys(perms).filter(
      (k) => !VALID_PERMISSIONS.includes(k as ValidPermission),
    )
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Permisos inválidos: [${invalid.join(', ')}]. Válidos: [${VALID_PERMISSIONS.join(', ')}]`,
      )
    }
  }

  /**
   * Tira si la operación dejaría 0 ADMINs activos (excluyendo al `excludeUserId`
   * que es el que está siendo modificado/eliminado en esta operación).
   */
  private async ensureAdminCountAfterChange(excludeUserId: string): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: { role: 'ADMIN', active: true, id: { not: excludeUserId } },
    })
    if (remaining < 1) {
      throw new BadRequestException('Debe quedar al menos un administrador activo')
    }
  }

  private async audit(
    userId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: 'User',
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    })
  }
}

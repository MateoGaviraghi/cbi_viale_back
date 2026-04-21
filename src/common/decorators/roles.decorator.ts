import { SetMetadata } from '@nestjs/common'
import type { UserRole } from '@prisma/client'

export const ROLES_KEY = 'roles'

/**
 * @Roles('ADMIN') — restringe el endpoint a usuarios con rol(es) específicos.
 * Se combina con JwtAuthGuard + RolesGuard.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)

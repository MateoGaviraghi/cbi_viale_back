import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSIONS_KEY, type Permission } from '../decorators/permissions.decorator'
import type { AuthUser } from '../decorators/current-user.decorator'

/**
 * PermissionsGuard — ADMIN pasa automáticamente. EMPLOYEE debe tener
 * el permiso declarado en User.permissions (Json).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>()
    if (!user) throw new ForbiddenException('No autenticado')
    if (user.role === 'ADMIN') return true

    const hasAll = required.every((perm) => user.permissions?.[perm] === true)
    if (!hasAll) {
      throw new ForbiddenException('No tenés los permisos necesarios')
    }
    return true
  }
}

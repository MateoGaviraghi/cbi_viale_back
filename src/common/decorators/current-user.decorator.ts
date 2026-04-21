import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { UserRole } from '@prisma/client'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  permissions: Record<string, boolean>
}

/**
 * @CurrentUser() — inyecta el usuario autenticado en el handler.
 * Requiere que JwtAuthGuard haya corrido antes (settea request.user).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>()
    return request.user
  },
)

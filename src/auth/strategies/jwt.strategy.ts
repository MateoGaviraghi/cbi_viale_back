import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import type { FastifyRequest } from 'fastify'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { AuthUser } from '../../common/decorators/current-user.decorator'
import type { Env } from '../../config/env.schema'
import { UsersService } from '../../users/users.service'

/**
 * JWT strategy — extrae el access_token de la cookie `access_token`.
 * Falla con 401 si no hay cookie, si está expirado, o si el user fue desactivado.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: FastifyRequest) => {
          const cookies = (req as FastifyRequest & { cookies?: Record<string, string> }).cookies
          return cookies?.access_token ?? null
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    })
  }

  async validate(payload: { sub: string; tokenVersion?: number }): Promise<AuthUser> {
    const user = await this.users.findByIdOrThrow(payload.sub).catch(() => null)
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario no válido o desactivado')
    }
    // Invalida tokens emitidos antes de un reset de password / softDelete. Los
    // tokens previos al deploy no traen tokenVersion → se tratan como 0 (no se
    // invalidan sesiones vigentes salvo que efectivamente cambie la versión).
    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Sesión expirada — volvé a iniciar sesión')
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: (user.permissions as Record<string, boolean>) ?? {},
    }
  }
}

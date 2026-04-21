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

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.users.findByIdOrThrow(payload.sub).catch(() => null)
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario no válido o desactivado')
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

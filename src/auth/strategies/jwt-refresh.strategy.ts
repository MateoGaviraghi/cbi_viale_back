import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import type { FastifyRequest } from 'fastify'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { Env } from '../../config/env.schema'
import { UsersService } from '../../users/users.service'

/**
 * Refresh strategy — extrae el refresh_token de la cookie `refresh_token`.
 * Si es válido, retorna el user para que AuthService emita un access_token nuevo.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: FastifyRequest) => {
          const cookies = (req as FastifyRequest & { cookies?: Record<string, string> }).cookies
          return cookies?.refresh_token ?? null
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_REFRESH_SECRET', { infer: true }),
    })
  }

  async validate(payload: { sub: string }) {
    const user = await this.users.findByIdOrThrow(payload.sub).catch(() => null)
    if (!user || !user.active) {
      throw new UnauthorizedException('Refresh token inválido')
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  }
}

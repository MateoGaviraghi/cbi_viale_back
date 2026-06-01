import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { User } from '@prisma/client'
import type { FastifyReply } from 'fastify'
import type { Env } from '../config/env.schema'
import { UsersService } from '../users/users.service'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.users.verifyPassword(email, password)
    if (!user) throw new UnauthorizedException('Credenciales inválidas')

    const tokens = await this.issueTokens(user)
    return { user, tokens }
  }

  async issueTokens(user: User): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
      {
        secret: this.config.get('JWT_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }),
      },
    )
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, tokenVersion: user.tokenVersion },
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
      },
    )
    return { accessToken, refreshToken }
  }

  /**
   * Setea ambas cookies HttpOnly en la respuesta Fastify.
   * - access_token: cookie corta (ver JWT_EXPIRES_IN)
   * - refresh_token: cookie larga, path restringido a /api/v1/auth/refresh
   */
  attachAuthCookies(reply: FastifyReply, tokens: AuthTokens): void {
    const secure = this.config.get('COOKIE_SECURE', { infer: true })
    const domain = this.resolveCookieDomain()

    const baseOpts = {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      domain,
      path: '/',
    }

    reply.setCookie('access_token', tokens.accessToken, {
      ...baseOpts,
      maxAge: 60 * 15, // 15 min
    })

    reply.setCookie('refresh_token', tokens.refreshToken, {
      ...baseOpts,
      path: '/api/v1/auth',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    })
  }

  clearAuthCookies(reply: FastifyReply): void {
    const domain = this.resolveCookieDomain()
    const opts = { path: '/', domain }
    reply.clearCookie('access_token', opts)
    reply.clearCookie('refresh_token', { ...opts, path: '/api/v1/auth' })
  }

  // Normaliza COOKIE_DOMAIN: trimea whitespace (copy-paste desde Railway suele
  // dejar tabs), y trata "localhost" y string vacío como "no setear Domain"
  // (cookie host-only del dominio del request — correcto para prod cross-domain).
  private resolveCookieDomain(): string | undefined {
    const raw = this.config.get('COOKIE_DOMAIN', { infer: true }).trim()
    if (raw === '' || raw === 'localhost') return undefined
    return raw
  }
}

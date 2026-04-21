import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { FastifyReply } from 'fastify'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'
import { Public } from '../common/decorators/public.decorator'
import { UsersService } from '../users/users.service'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Throttle({ strict: { limit: 5, ttl: 60_000 } }) // 5 intentos/min por IP
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login con email + password, setea cookies HttpOnly' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { user, tokens } = await this.auth.login(dto.email, dto.password)
    this.auth.attachAuthCookies(reply, tokens)
    return {
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Logout — limpia cookies' })
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    this.auth.clearAuthCookies(reply)
    return { data: { ok: true } }
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Emite un nuevo access_token usando el refresh_token' })
  async refresh(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const fullUser = await this.users.findByIdOrThrow(user.id)
    const tokens = await this.auth.issueTokens(fullUser)
    this.auth.attachAuthCookies(reply, tokens)
    return { data: { ok: true } }
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Info del usuario autenticado' })
  me(@CurrentUser() user: AuthUser) {
    return { data: user }
  }
}

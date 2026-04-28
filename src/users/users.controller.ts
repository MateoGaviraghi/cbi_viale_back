import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'
import { Permissions } from '../common/decorators/permissions.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdatePasswordDto } from './dto/update-password.dto'
import { UpdatePermissionsDto } from './dto/update-permissions.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserFiltersDto } from './dto/user-filters.dto'
import { UsersService } from './users.service'

@ApiTags('users')
@ApiCookieAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Permissions('manageUsers')
  @Get()
  @ApiOperation({ summary: 'Lista paginada de usuarios con filtros' })
  list(@Query() filters: UserFiltersDto) {
    return this.users.list(filters)
  }

  @Permissions('manageUsers')
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un usuario (sin passwordHash)' })
  getOne(@Param('id') id: string) {
    return this.users.getPublicByIdOrThrow(id)
  }

  @Roles('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea un usuario (default role EMPLOYEE)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.createFromAdmin(dto, user.id)
  }

  @Permissions('manageUsers')
  @Patch(':id')
  @ApiOperation({
    summary:
      'Update parcial — name, email, role, active. Soft delete via active=false. NO toca password ni permissions.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updateFromAdmin(id, dto, user.id)
  }

  @Roles('ADMIN')
  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Reemplaza el objeto permissions completo (whitelist server-side)' })
  updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updatePermissionsFromAdmin(id, dto, user.id)
  }

  @Roles('ADMIN')
  @Patch(':id/password')
  @ApiOperation({
    summary:
      'Reset de password (admin). NO invalida sesiones activas del user — el access token sigue válido hasta 15min y el refresh hasta 7d. Deuda Fase 2.',
  })
  updatePassword(
    @Param('id') id: string,
    @Body() dto: UpdatePasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updatePasswordFromAdmin(id, dto, user.id)
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete (active=false). Bloquea login. Idempotente. Nunca borra el último ADMIN.',
  })
  softDelete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.users.softDelete(id, user.id)
  }
}

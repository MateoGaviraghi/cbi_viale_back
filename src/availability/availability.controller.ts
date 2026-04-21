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
import { Public } from '../common/decorators/public.decorator'
import { AvailabilityService } from './availability.service'
import {
  BlockedDateFiltersDto,
  RuleFiltersDto,
} from './dto/availability-filters.dto'
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto'
import { CreateBlockedDateDto } from './dto/create-blocked-date.dto'
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto'
import { UpdateBlockedDateDto } from './dto/update-blocked-date.dto'

@ApiTags('availability')
@Controller({ path: 'availability', version: '1' })
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  // ---------------------------------------------------------------------------
  //  Público — consumido por el front (y reutilizado internamente por Appointments)
  // ---------------------------------------------------------------------------

  @Public()
  @Get('public/:serviceSlug')
  @ApiOperation({
    summary: 'Disponibilidad pública de un servicio: rules efectivas + bloqueos futuros',
  })
  getPublic(@Param('serviceSlug') slug: string) {
    return this.availability.getPublicAvailability(slug)
  }

  // ---------------------------------------------------------------------------
  //  Admin · AvailabilityRule
  // ---------------------------------------------------------------------------

  @ApiCookieAuth()
  @Permissions('manageAvailability')
  @Get('rules')
  @ApiOperation({ summary: 'Lista paginada de reglas de disponibilidad' })
  listRules(@Query() filters: RuleFiltersDto) {
    return this.availability.listRules(filters)
  }

  @ApiCookieAuth()
  @Permissions('manageAvailability')
  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea una regla de disponibilidad (valida overlap en el mismo scope)' })
  createRule(@Body() dto: CreateAvailabilityRuleDto, @CurrentUser() user: AuthUser) {
    return this.availability.createRule(dto, user.id)
  }

  @ApiCookieAuth()
  @Permissions('manageAvailability')
  @Patch('rules/:id')
  @ApiOperation({ summary: 'Actualización parcial de una regla' })
  updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.availability.updateRule(id, dto, user.id)
  }

  @ApiCookieAuth()
  @Permissions('manageAvailability')
  @Delete('rules/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Elimina una regla (hard delete — recomendamos PATCH active:false para preservar histórico)',
  })
  async deleteRule(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.availability.deleteRule(id, user.id)
    return { data: { ok: true } }
  }

  // ---------------------------------------------------------------------------
  //  Admin · BlockedDate
  // ---------------------------------------------------------------------------

  @ApiCookieAuth()
  @Permissions('manageAvailability')
  @Get('blocked-dates')
  @ApiOperation({ summary: 'Lista paginada de bloqueos (feriados, vacaciones, etc.)' })
  listBlockedDates(@Query() filters: BlockedDateFiltersDto) {
    return this.availability.listBlockedDates(filters)
  }

  @ApiCookieAuth()
  @Permissions('manageAvailability')
  @Post('blocked-dates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crea un bloqueo (no bloquea aunque existan turnos en el rango — solo loguea warn)',
  })
  createBlockedDate(@Body() dto: CreateBlockedDateDto, @CurrentUser() user: AuthUser) {
    return this.availability.createBlockedDate(dto, user.id)
  }

  @ApiCookieAuth()
  @Permissions('manageAvailability')
  @Patch('blocked-dates/:id')
  @ApiOperation({ summary: 'Actualización parcial de un bloqueo' })
  updateBlockedDate(
    @Param('id') id: string,
    @Body() dto: UpdateBlockedDateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.availability.updateBlockedDate(id, dto, user.id)
  }

  @ApiCookieAuth()
  @Permissions('manageAvailability')
  @Delete('blocked-dates/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina un bloqueo' })
  async deleteBlockedDate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.availability.deleteBlockedDate(id, user.id)
    return { data: { ok: true } }
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'
import { Permissions } from '../common/decorators/permissions.decorator'
import { Public } from '../common/decorators/public.decorator'
import { AppointmentsService } from './appointments.service'
import { AppointmentFiltersDto } from './dto/appointment-filters.dto'
import { CancelAppointmentDto } from './dto/cancel-appointment.dto'
import { CreateAppointmentDto } from './dto/create-appointment.dto'
import { GetAvailabilityQueryDto } from './dto/get-availability-query.dto'
import { ReprogramAppointmentDto } from './dto/reprogram-appointment.dto'
import { UpdateAppointmentDto } from './dto/update-appointment.dto'

@ApiTags('appointments')
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  // ---------------------------------------------------------------------------
  //  Público — consumido por el turnero del front
  // ---------------------------------------------------------------------------

  @Public()
  @Get('availability/:serviceSlug')
  @ApiOperation({
    summary: 'Slots disponibles del mes para un servicio',
    description:
      'Devuelve días del mes con sus slots libres (HH:MM local ARG). Combina reglas efectivas + bloqueos + turnos tomados + duración del servicio.',
  })
  getAvailability(
    @Param('serviceSlug') slug: string,
    @Query() query: GetAvailabilityQueryDto,
  ) {
    return this.appointments.getMonthlyAvailability(slug, query.month)
  }

  @Public()
  @Throttle({ strict: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crea un turno (PENDING), valida slot, encola email de confirmación',
  })
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointments.create(dto)
  }

  // ---------------------------------------------------------------------------
  //  Admin
  // ---------------------------------------------------------------------------

  @ApiCookieAuth()
  @Permissions('manageAppointments')
  @Get()
  @ApiOperation({ summary: 'Lista paginada de turnos con filtros' })
  list(@Query() filters: AppointmentFiltersDto) {
    return this.appointments.list(filters)
  }

  @ApiCookieAuth()
  @Permissions('manageAppointments')
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un turno con servicio asociado' })
  getOne(@Param('id') id: string) {
    return this.appointments.getByIdOrThrow(id)
  }

  @ApiCookieAuth()
  @Permissions('manageAppointments')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update parcial — status/notes. Pasar a CONFIRMED setea confirmedAt.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointments.update(id, dto, user.id)
  }

  @ApiCookieAuth()
  @Permissions('manageAppointments')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela el turno + email al paciente' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointments.cancel(id, dto, user.id)
  }

  @ApiCookieAuth()
  @Permissions('manageAppointments')
  @Post(':id/reprogram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprograma el turno a nueva fecha (revalida slot) + email al paciente',
  })
  reprogram(
    @Param('id') id: string,
    @Body() dto: ReprogramAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointments.reprogram(id, dto, user.id)
  }
}

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
  Res,
} from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'
import { Permissions } from '../common/decorators/permissions.decorator'
import { AppointmentsService } from '../appointments/appointments.service'
import { AppointmentFiltersDto } from '../appointments/dto/appointment-filters.dto'
import { CancelAppointmentDto } from '../appointments/dto/cancel-appointment.dto'
import { ReprogramAppointmentDto } from '../appointments/dto/reprogram-appointment.dto'
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto'
import { ConsentsService } from '../consents/consents.service'
import { ConsentFiltersDto } from '../consents/dto/consent-filters.dto'
import { PrismaService } from '../prisma/prisma.service'
import { SubmissionsService } from '../submissions/submissions.service'
import { SubmissionFiltersDto } from '../submissions/dto/submission-filters.dto'
import { UpdateSubmissionDto } from '../submissions/dto/update-submission.dto'

@ApiTags('admin')
@ApiCookieAuth()
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly submissions: SubmissionsService,
    private readonly consents: ConsentsService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Turnos ──────────────────────────────────────────────────────────────────

  @Permissions('manageAppointments')
  @Get('appointments')
  @ApiOperation({ summary: 'Lista paginada de turnos con filtros' })
  listAppointments(@Query() filters: AppointmentFiltersDto) {
    return this.appointments.list(filters)
  }

  @Permissions('manageAppointments')
  @Get('appointments/:id')
  @ApiOperation({ summary: 'Detalle de un turno' })
  getAppointment(@Param('id') id: string) {
    return this.appointments.getByIdOrThrow(id)
  }

  @Permissions('manageAppointments')
  @Patch('appointments/:id')
  @ApiOperation({ summary: 'Update parcial — status/notes. CONFIRMED setea confirmedAt.' })
  updateAppointment(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointments.update(id, dto, user.id)
  }

  @Permissions('manageAppointments')
  @Post('appointments/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela el turno + email al paciente' })
  cancelAppointment(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointments.cancel(id, dto, user.id)
  }

  @Permissions('manageAppointments')
  @Post('appointments/:id/reprogram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reprograma el turno a nueva fecha + email al paciente' })
  reprogramAppointment(
    @Param('id') id: string,
    @Body() dto: ReprogramAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointments.reprogram(id, dto, user.id)
  }

  // ── Consultas ────────────────────────────────────────────────────────────────

  @Permissions('manageSubmissions')
  @Get('submissions')
  @ApiOperation({ summary: 'Lista paginada de consultas con filtros' })
  listSubmissions(@Query() filters: SubmissionFiltersDto) {
    return this.submissions.list(filters)
  }

  @Permissions('manageSubmissions')
  @Get('submissions/:id')
  @ApiOperation({ summary: 'Detalle de una consulta' })
  getSubmission(@Param('id') id: string) {
    return this.submissions.getByIdOrThrow(id)
  }

  @Permissions('manageSubmissions')
  @Patch('submissions/:id')
  @ApiOperation({ summary: 'Transiciona status (PENDING → ANSWERED → ARCHIVED)' })
  updateSubmission(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.update(id, dto, user.id)
  }

  // ── Consentimientos ──────────────────────────────────────────────────────────

  @Permissions('manageConsents')
  @Get('consents')
  @ApiOperation({ summary: 'Lista paginada de consentimientos con filtros' })
  listConsents(@Query() filters: ConsentFiltersDto) {
    return this.consents.list(filters)
  }

  @Permissions('manageConsents')
  @Get('consents/:id')
  @ApiOperation({ summary: 'Detalle de un consentimiento' })
  getConsent(@Param('id') id: string) {
    return this.consents.getByIdOrThrow(id)
  }

  @Permissions('manageConsents')
  @Get('consents/:id/pdf')
  @ApiOperation({ summary: 'PDF del consentimiento informado (Content-Type: application/pdf)' })
  async getConsentPdf(@Param('id') id: string, @Res() reply: FastifyReply) {
    const { pdf, filename } = await this.consents.generatePdf(id)
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Length', String(pdf.length))
      .send(pdf)
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  @Permissions('manageAppointments')
  @Get('stats')
  @ApiOperation({ summary: 'Métricas generales del dashboard' })
  async getStats() {
    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)

    const [totalAppointments, totalSubmissions, totalConsents, appointmentsThisMonth] =
      await Promise.all([
        this.prisma.appointment.count(),
        this.prisma.formSubmission.count(),
        this.prisma.consent.count(),
        this.prisma.appointment.count({ where: { createdAt: { gte: startOfMonth } } }),
      ])

    return {
      data: { totalAppointments, totalSubmissions, totalConsents, appointmentsThisMonth },
    }
  }
}

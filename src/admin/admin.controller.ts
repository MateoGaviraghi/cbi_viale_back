import { Controller, Get, Param, Query, Res } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { Permissions } from '../common/decorators/permissions.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { AppointmentsService } from '../appointments/appointments.service'
import { AppointmentFiltersDto } from '../appointments/dto/appointment-filters.dto'
import { ConsentsService } from '../consents/consents.service'
import { ConsentFiltersDto } from '../consents/dto/consent-filters.dto'
import { PrismaService } from '../prisma/prisma.service'
import { SubmissionsService } from '../submissions/submissions.service'
import { SubmissionFiltersDto } from '../submissions/dto/submission-filters.dto'

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

  // ── Consultas ────────────────────────────────────────────────────────────────

  @Permissions('manageSubmissions')
  @Get('submissions')
  @ApiOperation({ summary: 'Lista paginada de consultas con filtros' })
  listSubmissions(@Query() filters: SubmissionFiltersDto) {
    return this.submissions.list(filters)
  }

  // ── Consentimientos ──────────────────────────────────────────────────────────

  @Roles('ADMIN')
  @Get('consents')
  @ApiOperation({ summary: 'Lista paginada de consentimientos con filtros' })
  listConsents(@Query() filters: ConsentFiltersDto) {
    return this.consents.list(filters)
  }

  @Roles('ADMIN')
  @Get('consents/:id')
  @ApiOperation({ summary: 'Detalle de un consentimiento' })
  getConsent(@Param('id') id: string) {
    return this.consents.getByIdOrThrow(id)
  }

  @Roles('ADMIN')
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

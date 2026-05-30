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
  Req,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'
import { Permissions } from '../common/decorators/permissions.decorator'
import { Public } from '../common/decorators/public.decorator'
import { CreateAgroFoodSubmissionDto } from './dto/create-agro-food-submission.dto'
import { CreateClinicalSubmissionDto } from './dto/create-clinical-submission.dto'
import { CreateEnvironmentalSubmissionDto } from './dto/create-environmental-submission.dto'
import { CreateGeneticSubmissionDto } from './dto/create-genetic-submission.dto'
import { CreateSubmissionDto } from './dto/create-submission.dto'
import { CreateUrocultureSubmissionDto } from './dto/create-uroculture-submission.dto'
import { CreateVaginalExudateSubmissionDto } from './dto/create-vaginal-exudate-submission.dto'
import { CreateVeterinarySubmissionDto } from './dto/create-veterinary-submission.dto'
import { SubmissionFiltersDto } from './dto/submission-filters.dto'
import { UpdateSubmissionDto } from './dto/update-submission.dto'
import { SubmissionsService } from './submissions.service'

const PUBLIC_THROTTLE = { strict: { limit: 10, ttl: 60_000 } }

@ApiTags('submissions')
@Controller({ path: 'submissions', version: '1' })
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  // ---------------------------------------------------------------------------
  //  Públicos — formularios del sitio
  // ---------------------------------------------------------------------------

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Genérico: contacto / consulta por servicio / consentimiento. Encola 2 emails.',
  })
  create(@Body() dto: CreateSubmissionDto) {
    return this.submissions.create(dto)
  }

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Post('clinical')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Formulario CLINICA_HUMANA. Requiere foto de pedido médico ya subida a Cloudinary (medicalOrderUrl). signatureUrl opcional genera Consent + PDF.',
  })
  createClinical(@Body() dto: CreateClinicalSubmissionDto, @Req() req: FastifyRequest) {
    return this.submissions.createClinical(dto, req.ip)
  }

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Post('uroculture')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Subformulario UROCULTURE. Si viene linkeado a un CLINICAL, mandar parentSubmissionId; si no, email + phone son obligatorios.',
  })
  createUroculture(@Body() dto: CreateUrocultureSubmissionDto, @Req() req: FastifyRequest) {
    return this.submissions.createUroculture(dto, req.ip)
  }

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Post('vaginal-exudate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Subformulario VAGINAL_EXUDATE. Si viene linkeado a un CLINICAL, mandar parentSubmissionId; si no, name + email + phone son obligatorios.',
  })
  createVaginalExudate(@Body() dto: CreateVaginalExudateSubmissionDto, @Req() req: FastifyRequest) {
    return this.submissions.createVaginalExudate(dto, req.ip)
  }

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Post('veterinary')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Formulario VETERINARY. Datos de propietario + animal + muestra.' })
  createVeterinary(@Body() dto: CreateVeterinarySubmissionDto) {
    return this.submissions.createVeterinary(dto)
  }

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Post('agro-food')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Formulario AGRO_FOOD. Datos de empresa + producto + análisis.' })
  createAgroFood(@Body() dto: CreateAgroFoodSubmissionDto) {
    return this.submissions.createAgroFood(dto)
  }

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Post('environmental')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Formulario ENVIRONMENTAL. Datos de empresa + muestra + análisis.' })
  createEnvironmental(@Body() dto: CreateEnvironmentalSubmissionDto) {
    return this.submissions.createEnvironmental(dto)
  }

  @Public()
  @Throttle(PUBLIC_THROTTLE)
  @Post('genetic')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Formulario GENETIC. Datos del paciente + estudio solicitado.' })
  createGenetic(@Body() dto: CreateGeneticSubmissionDto, @Req() req: FastifyRequest) {
    return this.submissions.createGenetic(dto, req.ip)
  }

  // ---------------------------------------------------------------------------
  //  Admin
  // ---------------------------------------------------------------------------

  @ApiCookieAuth()
  @Permissions('manageSubmissions')
  @Get()
  @ApiOperation({ summary: 'Lista paginada de consultas con filtros' })
  list(@Query() filters: SubmissionFiltersDto) {
    return this.submissions.list(filters)
  }

  @ApiCookieAuth()
  @Permissions('manageSubmissions')
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una consulta con servicio + subforms (children)' })
  getOne(@Param('id') id: string) {
    return this.submissions.getByIdOrThrow(id)
  }

  @ApiCookieAuth()
  @Permissions('manageSubmissions')
  @Patch(':id')
  @ApiOperation({
    summary:
      'Transiciona el status (PENDING → ANSWERED → ARCHIVED). ANSWERED setea answeredAt/By auto.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.update(id, dto, user.id)
  }
}

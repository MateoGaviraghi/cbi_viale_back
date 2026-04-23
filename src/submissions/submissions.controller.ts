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
import { CreateSubmissionDto } from './dto/create-submission.dto'
import { SubmissionFiltersDto } from './dto/submission-filters.dto'
import { UpdateSubmissionDto } from './dto/update-submission.dto'
import { SubmissionsService } from './submissions.service'

@ApiTags('submissions')
@Controller({ path: 'submissions', version: '1' })
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  // ---------------------------------------------------------------------------
  //  Público — formularios del sitio
  // ---------------------------------------------------------------------------

  @Public()
  @Throttle({ strict: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Recibe un formulario (contacto, consulta, consentimiento). Encola 2 emails.',
  })
  create(@Body() dto: CreateSubmissionDto) {
    return this.submissions.create(dto)
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
  @ApiOperation({ summary: 'Detalle de una consulta con servicio asociado' })
  getOne(@Param('id') id: string) {
    return this.submissions.getByIdOrThrow(id)
  }

  @ApiCookieAuth()
  @Permissions('manageSubmissions')
  @Patch(':id')
  @ApiOperation({
    summary: 'Transiciona el status (PENDING → ANSWERED → ARCHIVED). ANSWERED setea answeredAt/By auto.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.update(id, dto, user.id)
  }
}

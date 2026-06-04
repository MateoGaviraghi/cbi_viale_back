import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../common/decorators/public.decorator'
import { ServicesService } from './services.service'

@ApiTags('services')
@Controller({ path: 'services', version: '1' })
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista los 6 servicios activos' })
  async list() {
    const items = await this.services.listActive()
    return { data: items, meta: { total: items.length } }
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Detalle de un servicio por slug (clinica-humana, veterinaria, etc.)' })
  async findOne(@Param('slug') slug: string) {
    // Envelope explícito { data } por consistencia con el resto de la API. El
    // TransformInterceptor ya lo haría, pero lo dejamos explícito como en list().
    return { data: await this.services.findBySlugOrThrow(slug) }
  }
}

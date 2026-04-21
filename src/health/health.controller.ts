import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus'
import { Public } from '../common/decorators/public.decorator'
import { PrismaService } from '../prisma/prisma.service'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe — Railway/Kubernetes ready' })
  liveness() {
    return { data: { status: 'ok', ts: new Date().toISOString() } }
  }

  @Public()
  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — chequea conexión a Neon' })
  readiness() {
    return this.health.check([async () => this.db.pingCheck('neon_db', this.prisma)])
  }
}

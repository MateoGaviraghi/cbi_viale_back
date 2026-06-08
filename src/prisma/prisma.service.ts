import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaClient } from '@prisma/client'
import type { Env } from '../config/env.schema'

/**
 * PrismaService — singleton del Prisma Client con lifecycle hooks.
 * Se conecta al boot y desconecta limpio al shutdown para que Railway
 * termine las conexiones a Neon correctamente.
 *
 * Resiliencia al "cold start" de Neon: el free tier suspende el compute tras
 * ~5 min de inactividad. La primera conexión tras el idle despierta el compute
 * (~1-5s); durante ese lapso el pooler acepta el TCP pero la conexión real puede
 * tardar más que el `connect_timeout` default de Prisma (5s) → P1001 "Can't reach
 * database server". Para evitarlo: (1) subimos el connect_timeout para que Prisma
 * ESPERE el wake-up, (2) reintentamos el $connect() inicial con backoff.
 */

// Margen para tolerar el wake-up del compute de Neon. Se aplica en código (no en
// la URL del entorno) para que valga idéntico en local, staging y prod, sin drift
// entre envs ni manipular el secreto con el password.
const CONNECT_TIMEOUT_SECONDS = 15

// Reintentos del $connect() de boot: si el compute está dormido al arrancar, no
// crasheamos el contenedor (Railway lo reiniciaría en loop). Esperamos con backoff
// exponencial acotado y recién propagamos el error si Neon no responde tras varios
// intentos (ahí sí es un fallo real y conviene fail-fast).
const CONNECT_MAX_ATTEMPTS = 5
const CONNECT_BACKOFF_CAP_MS = 8000

/**
 * Agrega `connect_timeout` a la connection string si no lo trae ya. Se concatena
 * como string (no se reparsea la URL) para no re-encodear el password del secreto.
 */
function withConnectTimeout(url: string, seconds: number): string {
  if (/[?&]connect_timeout=/.test(url)) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}connect_timeout=${seconds}`
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService<Env, true>) {
    super({
      // Override del datasource `url` en runtime con el connect_timeout aplicado.
      // No afecta `directUrl` (solo lo usa el CLI de Prisma para migraciones).
      datasourceUrl: withConnectTimeout(
        config.get('DATABASE_URL', { infer: true }),
        CONNECT_TIMEOUT_SECONDS,
      ),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      errorFormat: 'minimal',
    })
  }

  async onModuleInit() {
    for (let attempt = 1; attempt <= CONNECT_MAX_ATTEMPTS; attempt++) {
      try {
        await this.$connect()
        return
      } catch (err) {
        if (attempt === CONNECT_MAX_ATTEMPTS) throw err
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), CONNECT_BACKOFF_CAP_MS)
        this.logger.warn(
          `Prisma $connect falló (intento ${attempt}/${CONNECT_MAX_ATTEMPTS}). ` +
            `Reintento en ${backoffMs}ms — posible cold start de Neon.`,
        )
        await sleep(backoffMs)
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}

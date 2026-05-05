import { BullModule } from '@nestjs/bullmq'
import type { DynamicModule } from '@nestjs/common'
import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config/env.schema'
import { EMAIL_QUEUE_NAME } from './emails.constants'
import { EmailsProcessor } from './emails.processor'
import { EmailsService } from './emails.service'

/**
 * Modos:
 *  - DIRECT (RESEND_API_KEY vacío en boot): NO registra BullMQ ni el processor.
 *    Evita que el worker intente conectarse a Redis cuando no hay nada que
 *    procesar. EmailsService usa el path "log + EmailLog SENT inmediato".
 *  - QUEUE (RESEND_API_KEY con valor): registra connection + queue + worker.
 *
 * La decisión es por env var leída en `forRoot()` — al boot, no en cada job.
 *
 * `global: true` para que cualquier módulo pueda inyectar EmailsService sin
 * importar EmailsModule explícitamente. Crítico porque submissions/appointments
 * NO importan este módulo dinámico (importarían el "estático" y crearían una
 * segunda instancia del service sin queue inyectada).
 */
@Global()
@Module({
  providers: [EmailsService],
  exports: [EmailsService],
})
export class EmailsModule {
  static forRoot(): DynamicModule {
    const apiKey = (process.env.RESEND_API_KEY ?? '').trim()
    const useQueue = apiKey !== ''

    if (!useQueue) {
      return {
        module: EmailsModule,
        global: true,
        providers: [EmailsService],
        exports: [EmailsService],
      }
    }

    return {
      module: EmailsModule,
      global: true,
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => {
            const url = new URL(config.get('REDIS_URL', { infer: true }))
            return {
              connection: {
                host: url.hostname,
                port: Number(url.port) || 6379,
                username: url.username || undefined,
                password: url.password || undefined,
                maxRetriesPerRequest: null,
              },
            }
          },
        }),
        BullModule.registerQueue({
          name: EMAIL_QUEUE_NAME,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { age: 86_400 },
            removeOnFail: { age: 604_800 },
          },
        }),
      ],
      providers: [EmailsService, EmailsProcessor],
      exports: [EmailsService],
    }
  }
}

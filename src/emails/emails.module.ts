import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config/env.schema'
import { EMAIL_QUEUE_NAME } from './emails.constants'
import { EmailsProcessor } from './emails.processor'
import { EmailsService } from './emails.service'

@Module({
  imports: [
    // Conexión Redis compartida para Queue + Worker.
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
            // Requerido por BullMQ en connections usadas por Workers.
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
        removeOnComplete: { age: 86_400 }, // 24h
        removeOnFail: { age: 604_800 }, // 7d
      },
    }),
  ],
  providers: [EmailsService, EmailsProcessor],
  exports: [EmailsService],
})
export class EmailsModule {}

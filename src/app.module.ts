import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { validateEnv } from './config/env.schema'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { ServicesModule } from './services/services.module'
import { AvailabilityModule } from './availability/availability.module'
import { AppointmentsModule } from './appointments/appointments.module'
import { EmailsModule } from './emails/emails.module'
import { SubmissionsModule } from './submissions/submissions.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    // Env vars con validación zod — falla al boot si falta algo crítico
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),

    // Structured logging con Pino (JSON en prod, pretty en dev)
    LoggerModule.forRootAsync({
      useFactory: (/* config: ConfigService */) => ({
        pinoHttp: {
          level: process.env.LOG_LEVEL ?? 'info',
          transport:
            process.env.NODE_ENV === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
          redact: ['req.headers.cookie', 'req.headers.authorization', '*.passwordHash'],
        },
      }),
    }),

    // Rate limiting global (100 req/min por IP). Endpoints específicos pueden
    // overridear con @Throttle() para ser más o menos estrictos.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'strict', ttl: 60_000, limit: 10 },
    ]),

    // Cron jobs (reminders 24h, cleanup, etc.)
    ScheduleModule.forRoot(),

    // Módulos propios
    PrismaModule,
    AuthModule,
    UsersModule,
    ServicesModule,
    AvailabilityModule,
    EmailsModule,
    AppointmentsModule,
    SubmissionsModule,
    HealthModule,
  ],
  providers: [
    // Rate limiting aplicado globalmente
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

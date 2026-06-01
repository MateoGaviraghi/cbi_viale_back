import 'reflect-metadata'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import type { Env } from './config/env.schema'

// Bootstrap CBI Viale backend — Fastify adapter (más performante que Express).
// Pipeline:
//  1. Helmet (headers de seguridad)
//  2. CORS whitelist explícita (front + localhost + dominio final)
//  3. Cookies parser con secret para sign/unsign
//  4. ValidationPipe global (class-validator + transform automático)
//  5. Exception filter global (formato JSON uniforme)
//  6. Transform interceptor (envuelve respuestas en { data, meta })
//  7. Swagger en /api/docs (protegido en prod con basic auth)
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Railway pone 1 proxy delante. Con `trustProxy: 1` Fastify deriva `req.ip`
      // del único hop confiable e ignora cualquier `X-Forwarded-For` inyectado por
      // el cliente. Con `true` se confiaba el header crudo → un atacante rotaba la
      // IP y evadía el ThrottlerGuard (que trackea por `req.ip`). Si Railway sumara
      // un segundo proxy, subir este número al nº real de hops.
      trustProxy: 1,
      logger: false, // usamos pino via nestjs-pino
    }),
    { bufferLogs: true },
  )

  app.useLogger(app.get(Logger))

  const config = app.get(ConfigService<Env, true>)
  const nodeEnv = config.get('NODE_ENV', { infer: true })
  const port = config.get('PORT', { infer: true })
  const corsOrigins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((s) => s.trim())
  const isProd = nodeEnv === 'production'

  // ------------- Seguridad -------------
  // CSP base aplicada en TODO entorno (antes solo en prod → un staging sin
  // NODE_ENV=production quedaba sin CSP). 'unsafe-inline' en script/style es
  // necesario para Swagger UI, que solo se monta fuera de prod (ver más abajo).
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        baseUri: [`'self'`],
        frameAncestors: [`'none'`],
        objectSrc: [`'none'`],
        scriptSrc: [`'self'`, `'unsafe-inline'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, 'data:', 'https://res.cloudinary.com'],
        connectSrc: [`'self'`, ...corsOrigins],
      },
    },
  })

  await app.register(fastifyCors, {
    origin: corsOrigins,
    credentials: true, // para enviar/recibir cookies
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  })

  await app.register(fastifyCookie, {
    secret: config.get('COOKIE_SECRET', { infer: true }), // secret dedicado (≠ JWT_SECRET)
  })

  // ------------- Validation global -------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remueve props no declaradas en DTO
      forbidNonWhitelisted: true, // error si llegan props de más
      transform: true, // convierte payloads a instancias de DTO
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new TransformInterceptor())

  // ------------- Versionado ----------------
  app.setGlobalPrefix('api', { exclude: ['health', 'health/liveness', 'health/readiness'] })
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  // ------------- Swagger (solo fuera de producción) -------------
  // En prod NO se monta: evita exponer el spec JSON y reduce la superficie de
  // reconocimiento de la API. En dev sirve la doc interactiva en /api/docs.
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CBI Viale API')
      .setDescription('API del Centro Bioquímico Integral de Viale, Entre Ríos')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .addTag('auth', 'Autenticación (login, logout, refresh, me)')
      .addTag('services', 'Catálogo de los 6 servicios de CBI')
      .addTag('appointments', 'Reserva de turnos y gestión admin')
      .addTag('submissions', 'Formularios de contacto y consultas')
      .addTag('availability', 'Horarios de atención y bloqueos (admin)')
      .addTag('admin', 'Dashboard admin: appointments, submissions, consents, stats')
      .addTag('users', 'Gestión de usuarios admin/empleados')
      .addTag('health', 'Health checks')
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'CBI Viale · API Docs',
    })
  }

  // ------------- Graceful shutdown -------------
  app.enableShutdownHooks()

  await app.listen({ port, host: '0.0.0.0' })

  const logger = app.get(Logger)
  logger.log(`🚀 CBI Viale API lista en puerto ${port} (${nodeEnv})`)
  if (!isProd) logger.log(`📘 Swagger: http://localhost:${port}/api/docs`)
  logger.log(`🔐 CORS origins: ${corsOrigins.join(', ')}`)
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Bootstrap failed:', err)
  process.exit(1)
})

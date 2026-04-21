import { z } from 'zod'

// Validación de env vars al boot. Si falta algo crítico el proceso NO arranca.
// Estructura todo en zod para tener tipado + defaults + mensajes claros.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database (Neon)
  DATABASE_URL: z.string().url('DATABASE_URL inválida — revisar pooled connection Neon'),
  DIRECT_URL: z.string().url('DIRECT_URL inválida — revisar direct connection Neon'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Cookies
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Redis (BullMQ + cache)
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Resend
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('CBI Viale <no-reply@cbiviale.com.ar>'),
  RESEND_REPLY_TO: z.string().default('contacto@cbiviale.com.ar'),

  // Negocio
  BUSINESS_NOTIFICATION_EMAIL: z.string().default('contacto@cbiviale.com.ar'),

  // Cron
  CRON_SECRET: z.string().default(''),

  // Swagger
  SWAGGER_USER: z.string().default('admin'),
  SWAGGER_PASSWORD: z.string().default(''),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Seed (sólo se usa al correr prisma seed)
  SEED_ADMIN_EMAIL: z.string().email().default('admin@cbiviale.com.ar'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('cbi-admin-2026'),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw)
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Env vars inválidas:\n', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment configuration')
  }
  return parsed.data
}

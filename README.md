# CBI Viale — Backend API

API REST del **Centro Bioquímico Integral** de Viale, Entre Ríos.

Desarrollado por [Nodo](https://nodotech.dev).

---

## Stack

- **NestJS 10** con **Fastify adapter** (no Express) — 2–3× más performant
- **Prisma 5** + **Neon PostgreSQL** (misma DB que el front)
- **Passport JWT** + **cookies HttpOnly** (SameSite=Lax, Secure en prod)
- **BullMQ** + **Redis** (Upstash / Railway) — jobs pesados en background
- **Resend** + **React Email** — emails transaccionales
- **class-validator** + **class-transformer** — DTOs
- **@nestjs/throttler** — rate limiting
- **@nestjs/terminus** — health checks
- **@nestjs/schedule** — cron jobs
- **Swagger** — docs auto generadas en `/api/docs`
- **Pino** — structured logging

Deploy: **Railway** (always-on, sin cold starts, auto-deploy desde GitHub).

## Setup local

```bash
# 1. Dependencias
npm install

# 2. Env vars
cp .env.example .env
# editar .env con URLs reales de Neon + secrets

# 3. Generar Prisma client + push schema (si la DB no tiene tablas aún)
npm run db:generate
npm run db:push

# 4. Seed (si aún no corrió desde el front)
npm run db:seed

# 5. Dev server
npm run start:dev
```

API corre en `http://localhost:3001`. Swagger en `http://localhost:3001/api/docs`.

## Scripts

| Comando                    | Acción                                     |
|----------------------------|--------------------------------------------|
| `npm run start:dev`        | Dev con hot reload                         |
| `npm run build`            | Build de producción                        |
| `npm run start:prod`       | Correr build de producción                 |
| `npm run lint`             | ESLint + auto-fix                          |
| `npm run format`           | Prettier                                   |
| `npm run type-check`       | `tsc --noEmit`                             |
| `npm run test`             | Jest                                       |
| `npm run db:push`          | Push schema a Neon (dev)                   |
| `npm run db:migrate`       | Crear migración                            |
| `npm run db:seed`          | Seed servicios + admin                     |
| `npm run db:studio`        | Prisma Studio (GUI)                        |

## Arquitectura

```
src/
├── main.ts                     # Bootstrap (Fastify + helmet + cors + swagger)
├── app.module.ts               # Root module
├── config/                     # Env validation (zod)
├── prisma/                     # Prisma module + service
├── common/
│   ├── decorators/             # @CurrentUser, @Public, @Roles, @Permissions
│   ├── guards/                 # JwtAuthGuard, RolesGuard, PermissionsGuard
│   ├── filters/                # AllExceptionsFilter (formato JSON uniforme)
│   └── interceptors/           # TransformInterceptor
├── auth/                       # login, logout, refresh, me
├── users/                      # gestión de admin/employees
├── services/                   # catálogo de los 6 servicios de CBI
├── appointments/               # turnos + availability calculation
├── submissions/                # formularios de contacto
├── availability/               # admin: rules + blocked dates
├── emails/                     # Resend + templates
├── cron/                       # recordatorios 24h
└── health/                     # /health/liveness, /health/readiness
```

## Endpoints principales (ver Swagger `/api/docs`)

**Públicos (sin auth):**
- `GET /services` — catálogo
- `GET /services/:slug` — detalle
- `GET /appointments/availability/:serviceSlug` — slots disponibles
- `POST /appointments` — crear turno
- `POST /submissions` — form de contacto

**Admin (requieren JWT):**
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET/PATCH/DELETE /appointments/*`
- `GET/PATCH /submissions/*`
- `CRUD /users` (solo ADMIN)
- `CRUD /availability/*`
- `PATCH /services/:slug` (editar contenido)

## Formato de respuesta

**Éxito:**
```json
{ "data": { ... }, "meta": { ... } }
```

**Error:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "path": "/appointments",
  "timestamp": "2026-04-21T14:30:00.000Z"
}
```

## Seguridad

- Todas las queries vía Prisma (previene SQL injection)
- Passwords con bcrypt (10 rounds)
- JWT en cookies HttpOnly + SameSite=Lax + Secure en prod
- Rate limiting 100 req/min por IP en endpoints públicos
- Helmet con CSP estricto
- CORS whitelist explícita
- Refresh token rotation
- Audit log persistido en DB

## Deploy (Railway)

```bash
# Opción 1: CLI
railway login
railway link    # vincular a proyecto existente
railway up

# Opción 2 (recomendada): GitHub
# Conectar repo a Railway → auto-deploy desde main
```

Env vars a configurar en Railway:
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL`,
`RESEND_API_KEY`, `CORS_ORIGINS`, `CRON_SECRET`, `COOKIE_DOMAIN`, `COOKIE_SECURE=true`,
`NODE_ENV=production`.

## Derechos

© 2026 CBI Viale · Código propiedad de nodotech.dev hasta pago final; luego derechos de uso completo al cliente.

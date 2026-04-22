# CBI Viale — Backend · Plan de Acción y Handoff

> **Cómo usar este archivo:** este es el contexto de arranque para un chat nuevo dedicado al backend. Pegalo o abrí el archivo y arrancá con la frase del final ("Para arrancar este chat"). Está pensado para que el agente entienda TODO sin necesidad de leer otras conversaciones.

---

## 1. Cliente y proyecto

- **Cliente:** CBI — Centro Bioquímico Integral (empresa reciente, evitar referencias tipo "desde 2009").
- **Ubicación:** Manuel Belgrano 594 (esquina Gregoria Pérez), Viale, Entre Ríos, Argentina.
- **Tagline:** "Donde la ciencia y el cuidado se encuentran."
- **Contacto:** Tel/WhatsApp 543433020527 · IG @cbi_viale · Lun-Vie 07:00–12:00 y 14:00–18:00, Sáb 08:00–12:00.
- **6 servicios** (enum `ServiceSlug` en Prisma):
  1. `CLINICA_HUMANA` (slug url: `clinica-humana`) — 30 min
  2. `VETERINARIA` (`veterinaria`) — 30 min
  3. `AGRO_ALIMENTOS` (`agro-alimentos`) — 45 min
  4. `AMBIENTAL` (`ambiental`) — 30 min
  5. `MEDICINA_REGENERATIVA` (`medicina-regenerativa`) — 60 min, requiere consentimiento
  6. `GENETICA` (`genetica`) — 30 min, requiere consentimiento
- **Beneficios destacados:** recibe todas las obras sociales · sin adicionales · extracciones a domicilio para particulares.
- **Repo front (separado):** `~/Desktop/cbi-viale-front` — Next.js 14 puro cliente, NO toca DB, consume este back via `/api/v1/*`.

---

## 2. Stack del back (versiones pinned)

- **NestJS 10.4.6** + **`@nestjs/platform-fastify` 10.4.6** + **fastify 4.28.1** (NO Express)
- **Fastify plugins** (versiones críticas por compat Fastify v4):
  - `@fastify/cookie` 9.4.0 · `@fastify/cors` 9.0.1 · `@fastify/helmet` 11.1.1 · `@fastify/static` 7.0.4
- **Prisma 5.20** + `@prisma/client` + **Neon PostgreSQL** (DATABASE_URL pooled, DIRECT_URL para migraciones)
- **TypeScript 5.5.4** estricto (`noUncheckedIndexedAccess`, sin `any`)
- **Auth:** `@nestjs/jwt` 10.2 + `passport-jwt` + `bcryptjs` (10 rounds)
- **Validación:** `class-validator` + `class-transformer` para DTOs · `zod 3.23.8` para env vars
- **Jobs/queues:** `bullmq 5.25` + `ioredis 5.4` + `@nestjs/schedule 4.1`
- **Observability:** `nestjs-pino` + `@nestjs/swagger 8` (Swagger en `/api/docs`) + `@nestjs/terminus` (health) + `@nestjs/throttler 6` (100/min default, 10/min strict)
- **Emails:** `resend 4` + `@react-email/components`
- **Runtime:** Node ≥20 · dev en `:3001` · Swagger en `/api/docs`
- **Deploy:** Railway always-on, auto-deploy desde GitHub `main`, Redis via addon

---

## 3. Estado actual

### ✅ Hecho

- **Skeleton + bootstrap** completo (Helmet, CORS whitelist, cookies HttpOnly, ValidationPipe global, AllExceptionsFilter con manejo P2002/P2025, TransformInterceptor `{ data, meta }`, prefix `/api`, versioning URI v1, Pino, Swagger, graceful shutdown).
- **Common layer:** decorators (`@Public`, `@CurrentUser`, `@Roles`, `@Permissions`), guards (`JwtAuthGuard` global, `RolesGuard`, `PermissionsGuard` — ADMIN pasa siempre), filters, interceptors.
- **AuthModule:** `POST /auth/login` (5/min strict) · `POST /logout` · `POST /refresh` · `GET /me`. Cookies HttpOnly: `access_token` (15min, path `/`) y `refresh_token` (7d, path `/api/v1/auth`). Strategies JWT y JWT-refresh.
- **UsersModule:** solo `UsersService` con `findByEmail`, `findByIdOrThrow`, `createUser` (bcrypt 10 rounds), `verifyPassword`. **SIN controller todavía.**
- **ServicesModule:** `GET /services` y `GET /services/:slug` (kebab-case → enum vía SLUG_MAP). Ambos `@Public()`.
- **AvailabilityModule:** 9 endpoints (`/availability/public/:slug` público + CRUD admin de rules y blocked-dates con `manageAvailability`). Override semántico: específicas reemplazan globales. Validaciones overlap, regex HH:MM, end > start. Audit log inline.
- **HealthModule:** `/health/liveness`, `/health/readiness`. ⚠️ Deuda: dieron 404 en pruebas iniciales — investigar si bloquea Railway healthcheck.

### 🔴 Pendiente

Ver sección 5 (Plan de fases). Orden forzado por dependencias.

### Deuda abierta

- Limpiar remanentes NextAuth en schema (`Account`, `Session`, `VerificationToken`) — hacer cuando UsersModule admin esté funcional.
- `UsersModule` necesita controller con endpoints admin.
- Refactor `audit()` privado de `AvailabilityService` → `AuditLogModule` cuando exista (Fase B5).
- 404 en `/health/readiness` — investigar.

### 14 modelos en `prisma/schema.prisma`

`User`, `Account`, `Session`, `VerificationToken` (los 3 últimos a eliminar), `Service`, `ServiceImage`, `ServiceAnalysis`, `Appointment`, `AvailabilityRule`, `BlockedDate`, `FormSubmission`, `EmailLog`, `AuditLog`, `PageView`.

---

## 4. Lo que pasó en sesión 2026-04-21 (alineación con el front)

Antes de esta sesión, el front estaba mal armado: tenía NextAuth + Prisma + Resend instalados como si fuera un monolito. Se hizo cirugía en el front para dejarlo como **cliente puro** del back:

- Front eliminó `prisma/`, `auth.ts`, `auth.config.ts`, `middleware.ts`, `lib/db.ts`, `lib/auth-permissions.ts`, `lib/email/`, `types/next-auth.d.ts`, `app/api/auth/`. Quitó 9 deps de su `package.json`.
- Front creó capa `src/lib/api/` con `apiFetch<T>()` tipado, manejo del envelope `{ data, meta }`, `ApiError`, y endpoints (`api.auth.*`, `api.services.*`, `api.availability.*`).
- Front configuró `next.config.mjs` con `rewrites()` que proxyea `/api/v1/:path*` → `${API_URL}/api/v1/:path*`. Así desde el browser se ve mismo origen y las cookies HttpOnly fluyen sin CORS cross-site.
- Front `.env` quedó con solo 2 vars: `NEXT_PUBLIC_SITE_URL` y `API_URL`. Cero secretos.
- Probado end-to-end: front fetcheó `/api/v1/services` via rewrite → 6 servicios del seed. Login inválido → 401 con shape correcto.

**Implicancia para el back:** desde ahora cualquier endpoint nuevo se diseña pensando que un cliente HTTP tipado lo va a consumir. Mantener el envelope `{ data, meta }`, los códigos HTTP standard, y el shape de error `{ statusCode, message, error, path, timestamp }`.

---

## 5. PLAN BACK · Fases

### B1 — AppointmentsModule ⭐ *(prioridad absoluta — bloquea el turnero del front)*

**Endpoints:**

| Método | Path | Auth | Propósito |
|---|---|---|---|
| `GET` | `/api/v1/appointments/availability/:serviceSlug?month=YYYY-MM` | `@Public()` | Slots disponibles del mes (combina rules + blocked + turnos tomados + duration) |
| `POST` | `/api/v1/appointments` | `@Public()`, throttle 10/min | Crea turno PENDING, valida slot libre, encola email confirmación |
| `GET` | `/api/v1/appointments` | `@Permissions('manageAppointments')` | Lista paginada con filtros |
| `GET` | `/api/v1/appointments/:id` | idem | Detalle |
| `PATCH` | `/api/v1/appointments/:id` | idem | Status, notes, confirmedAt |
| `POST` | `/api/v1/appointments/:id/cancel` | idem | status=CANCELLED + cancelReason + email |
| `POST` | `/api/v1/appointments/:id/reprogram` | idem | Cambia date + email |

**Algoritmo de slots** (en `AppointmentsService`):
1. Pedir reglas efectivas con `availability.getEffectiveRulesForService(serviceId)`.
2. Para cada día del mes solicitado: si está en `BlockedDate` (via `availability.isDateBlockedForService`), saltar.
3. Para cada regla del weekday correspondiente: generar slots cada `service.durationMinutes`.
4. Restar slots ocupados (`Appointment` con status PENDING o CONFIRMED en ese rango).
5. Devolver `{ date, slots: ['08:00', '08:30', ...] }[]` para el mes.

**Filtros del list admin:** `status`, `serviceSlug`, `dateFrom`, `dateTo`, `q` (búsqueda en `patientName`/`patientDni`/`patientEmail`/`patientPhone`).

**Validaciones POST público:**
- `serviceSlug` válido.
- `date` futuro y dentro de slot válido (re-correr el algoritmo en backend, NO confiar en lo que mande el front).
- Si `service.requiresConsent` → `consentGiven: true`.
- DNI: regex argentino `^\d{7,8}$`.
- Email + teléfono validados con class-validator.

**Audit log:** `APPOINTMENT_CREATE`, `APPOINTMENT_PATCH`, `APPOINTMENT_CANCEL`, `APPOINTMENT_REPROGRAM`.

**Criterio terminado:** seeds + 8-10 casos probados con curl + audit log persistido + `type-check` + `build` limpios.

**Desbloquea front:** F3 (turnero pasos 2-5).

---

### B2 — EmailsModule (mínimo viable)

Necesario para que B1 dispare confirmación. Puede ir en paralelo con B1 (Appointments puede enquear sin que el worker esté listo).

- BullMQ queue `emails` + worker.
- 3 templates con `@react-email/components`: `AppointmentConfirmation`, `AppointmentCancelled`, `AppointmentReprogrammed`.
- `EmailsService.enqueue(kind, to, payload)` usado desde Appointments.
- Worker: render → Resend → grabar `EmailLog`.
- **Modo dev sin API key:** si `RESEND_API_KEY` vacío → log a consola + marcar EmailLog como SENT.

**Criterio terminado:** turno creado → job encolado → email enviado (o logueado si dev) → `EmailLog` con status SENT.

---

### B3 — SubmissionsModule

Para los formularios del sitio (contacto general, consultas por servicio).

| Método | Path | Auth |
|---|---|---|
| `POST` | `/api/v1/submissions` | `@Public()`, throttle 10/min |
| `GET` | `/api/v1/submissions` | `manageSubmissions` |
| `GET` | `/api/v1/submissions/:id` | idem |
| `PATCH` | `/api/v1/submissions/:id` | idem (cambiar status, anotaciones) |

**Templates email:** `FormSubmissionReceipt` (al remitente) + `InternalSubmissionNotification` (a `BUSINESS_NOTIFICATION_EMAIL`).

**Filtros admin:** `type`, `status`, `serviceSlug`, `dateFrom`, `dateTo`, `q` (nombre/email).

**Desbloquea front:** F4 (formularios).

---

### B4 — UsersModule endpoints admin

| Método | Path | Auth |
|---|---|---|
| `GET` | `/api/v1/users` | `@Roles('ADMIN')` |
| `GET` | `/api/v1/users/:id` | idem (o EMPLOYEE leyendo su propio perfil) |
| `POST` | `/api/v1/users` | `@Roles('ADMIN')` — crea EMPLOYEE con `defaultEmployeePermissions()` |
| `PATCH` | `/api/v1/users/:id` | `@Roles('ADMIN')` — name, permissions, active |
| `DELETE` | `/api/v1/users/:id` | `@Roles('ADMIN')` — soft delete (active=false) |

**Importante:** `passwordHash` NUNCA en respuestas. Usar `select` explícito en Prisma.

**Cleanup:** eliminar modelos `Account`, `Session`, `VerificationToken` del schema + migración.

**Desbloquea front:** F5 tab usuarios.

---

### B5 — Fase 2 (días 30-60)

- **CronModule:** `@nestjs/schedule` job diario 08:00 → encola reminders de turnos en 24-26hs. Webhook `POST /api/v1/cron/trigger-reminders` con header `CRON_SECRET` (Railway/Vercel Cron). AuditLog del envío.
- **AuditLogModule:** helper inyectable `.log(userId, action, entity, entityId, metadata)`. `GET /audit-logs` admin con filtros + paginación. Permiso `viewAuditLog`. Refactorizar `audit()` privados existentes (Availability + Appointments + Submissions + Users) para usar el helper.
- **ExportsModule:** `POST /appointments/export`, `POST /submissions/export` encolan BullMQ. Worker genera PDF (jsPDF) o Excel (xlsx), sube a Cloudflare R2 o similar, devuelve URL firmada. `GET /exports/:jobId` para status + URL.

### Fase 3 (post día 60)

- **AnalyticsModule:** `POST /pageviews` desde el front. Dashboard admin: turnos por servicio/día/semana/mes, tasa cancelación, funnel.
- **Sentry** para errores prod.

---

## 6. Reglas para no pisar al front

1. **El front es cliente puro.** No tiene Prisma, no tiene NextAuth, no tiene Resend. Cualquier persistencia o envío de email vive 100% acá.
2. **Mantener el contrato.** Si vas a cambiar el shape de una respuesta (renombrar campo, cambiar tipo, mover a meta), avisarle al front antes — necesita actualizar `src/lib/api/types.ts` en el mismo ciclo.
3. **Envelope uniforme NO se rompe.** Todo response success debe ser `{ data, meta? }`. Errores: `{ statusCode, message, error, path, timestamp }`.
4. **CORS:** mantener `CORS_ORIGINS` actualizado con los dominios del front (dev `http://localhost:3000`, vercel preview, prod final).
5. **Cookies:** no cambiar `SameSite=Lax` ni el `path=/api/v1/auth` del refresh sin avisar — el front depende de ese comportamiento.
6. **Endpoints públicos sensibles** (login, submissions, appointments POST) DEBEN tener `@Throttle` strict. El front asume que se le devuelve 429 en abuso para mostrar UX adecuada.

---

## 7. Convenciones de trabajo

- **Commits en español**, Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
- **NO hacer push sin OK explícito del usuario.** Frases que autorizan: "dale push", "hagamos push", "pusheá". Silencio NO autoriza.
- **Plan ANTES de código.** Para cualquier módulo nuevo, mostrar al usuario: endpoints (método+path+auth+propósito), DTOs (input + output shape), lógica clave, validaciones, edge cases. Esperar OK antes de escribir.
- **Patrón canon:** copiar la estructura de `src/auth/` o `src/services/` para módulos nuevos. NO inventar layouts.
- **DTOs siempre con `@ApiProperty`** para que aparezcan en Swagger.
- **TypeScript estricto, sin `any`.** Usar `unknown` + type guards.
- **Audit log inline** en mutaciones admin sensibles (mientras `AuditLogModule` no exista — Fase B5).
- **Después de cada módulo:** `npm run type-check && npm run build` + curl/Swagger probados, mostrar resultado al usuario.
- **Sin `console.log`** — usar el logger inyectado de Pino.
- **Documentar siempre.** Tras cada módulo terminado o decisión técnica no obvia, actualizar:
  - `.claude/projects/c--Users-mateo-Desktop-cbi-viale-back/memory/project_modules_status.md` (mover de pendiente a hecho)
  - `.claude/projects/.../project_decisions.md` (si hubo decisión arquitectónica)
  - `.claude/projects/.../project_progress_log.md` (entrada cronológica)
  - `PROGRESS.md` en este repo (visible al equipo)

---

## 8. Comandos útiles

```bash
# Desarrollo
npm run start:dev          # nest --watch en :3001
npm run start:debug        # con --inspect
npm run type-check
npm run build
npm run lint

# DB
npm run db:generate        # prisma generate
npm run db:migrate         # prisma migrate dev (interactivo)
npm run db:migrate:deploy  # prod
npm run db:seed            # tsx --env-file=.env prisma/seed.ts
npm run db:studio          # GUI prisma

# Pruebas
npm test                   # jest
npm run test:e2e

# Swagger
# http://localhost:3001/api/docs

# Health
# http://localhost:3001/health/liveness
# http://localhost:3001/health/readiness  ⚠️ revisar — daba 404
```

**Env vars críticas (`.env` local):** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (≥32), `JWT_REFRESH_SECRET` (≥32), `COOKIE_DOMAIN=localhost`, `CORS_ORIGINS=http://localhost:3000`, `RESEND_API_KEY` (opcional en dev).

---

## 9. Mapeo contra reuniones del presupuesto

| Reunión | Estado del back |
|---|---|
| **Día 15** | B1 + B2 en curso |
| **Día 30** | B1 + B2 + B3 + B4 terminados |
| **Día 45** | B5 (cron + audit + exports) en curso |
| **Día 60** | Cerrado + Sentry + analytics |

---

## 10. Para arrancar este chat

> Leé `PLAN.md` completo (este archivo). Después leé la memoria del proyecto en `~/.claude/projects/c--Users-mateo-Desktop-cbi-viale-back/memory/` (`MEMORY.md` y archivos referenciados). Después confirmame que entendiste el estado y propone arrancar por **B1 (AppointmentsModule)**: mostrame el plan de endpoints + DTOs + algoritmo de slots + validaciones, y esperá mi OK antes de escribir código. Recordá: commits en español, NO push sin OK, plan antes de código, audit log en mutaciones admin.

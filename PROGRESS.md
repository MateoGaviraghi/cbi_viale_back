# CBI Viale Backend — Log de Progreso

Documento vivo del avance del backend. Actualizado tras cada unidad de trabajo significativa (módulo terminado, decisión técnica, push, deploy).

> **Formato:** entradas cronológicas descendentes (más reciente arriba). Cada sesión lleva fecha, qué se hizo, decisiones tomadas, pruebas ejecutadas, commits generados y qué quedó abierto.

---

## Estado general

| Área | Estado |
|---|---|
| Skeleton (Nest + Fastify + Prisma + Auth + Services + Health) | ✅ en `main` |
| AvailabilityModule (CRUD admin + lectura pública) | ✅ en `main` |
| AppointmentsModule (turnos + algoritmo de slots ARG-tz) | ✅ local · pendiente push |
| EmailsModule (stub para B2 — log + EmailLog SENT) | ✅ local · pendiente push |
| SubmissionsModule | 🔴 próximo (B3) |
| UsersModule (endpoints admin) | 🔴 Fase 1 (B4) |
| EmailsModule completo (React Email + Resend + BullMQ) | 🔴 Fase 1 — reemplaza el stub |
| CronModule (recordatorios 24h) | 🟡 Fase 2 |
| AuditLogModule (helper + endpoints admin) | 🟡 Fase 2 |
| ExportsModule (PDF/Excel a R2) | 🟡 Fase 2 |
| AnalyticsModule (PageView + dashboard) | 🟢 Fase 3 |
| Sentry integration | 🟢 Fase 3 |
| Deploy Railway auto desde `main` | Pendiente de verificar primer build |

**Repo:** [MateoGaviraghi/cbi_viale_back](https://github.com/MateoGaviraghi/cbi_viale_back) · branch `main`.

---

## 2026-04-22 · Sesión 2 — AppointmentsModule + EmailsModule stub

### Contexto de entrada

Skeleton + AvailabilityModule ya en `main` desde la sesión anterior. El front ya se alineó como cliente puro (sin Prisma/NextAuth/Resend — usa un `apiFetch` tipado + rewrites Next.js para que las cookies HttpOnly fluyan sin cross-origin). `PLAN.md` agregado al repo como fuente de verdad del roadmap.

### 1. Plan presentado y aprobado

- Endpoints: 2 públicos (`GET /availability/:slug?month=YYYY-MM`, `POST /`) + 5 admin (list/get/patch/cancel/reprogram).
- 6 DTOs con class-validator + ApiProperty.
- Algoritmo de slots timezone-aware (ARG UTC-3 fijo, sin DST).
- Concurrency con `$transaction` Serializable + re-check dentro.
- Validaciones: slot futuro con margen 5min, alineado a duración, no bloqueado, consent para servicios con `requiresConsent`, DNI regex `^\d{7,8}$`, teléfono `^\+?\d{8,15}$`.
- EmailsModule stub para no bloquear B1 — contrato `enqueue()` estable.

### 2. Implementación — EmailsModule stub

**Archivos creados** (2):

```
src/emails/
├── emails.module.ts
└── emails.service.ts
```

`EmailsService.enqueue({ kind, to, subject, appointmentId?, payload })`:
- Log estructurado con Pino (`this.logger.log({ event: 'email.enqueue (stub)', ... })`).
- Persiste `EmailLog` con `status: SENT`, `sentAt: new Date()`.
- Cuando se complete B2 (BullMQ + React Email + Resend), se reemplaza la implementación sin tocar callsites.

### 3. Implementación — AppointmentsModule

**Archivos creados** (9):

```
src/appointments/
├── appointments.module.ts
├── appointments.controller.ts        # 7 endpoints
├── appointments.service.ts           # CRUD + algoritmo slots + concurrency + audit inline
├── utils/timezone.ts                 # localArgToUtc / utcToLocalArgParts / jsWeekdayToPrisma
└── dto/
    ├── appointment-filters.dto.ts    # extends PaginationDto
    ├── cancel-appointment.dto.ts
    ├── create-appointment.dto.ts
    ├── get-availability-query.dto.ts
    ├── reprogram-appointment.dto.ts
    └── update-appointment.dto.ts
```

**Endpoints resultantes:**

| Método | Path | Auth | Throttle |
|---|---|---|---|
| `GET` | `/api/v1/appointments/availability/:serviceSlug?month=YYYY-MM` | `@Public()` | default |
| `POST` | `/api/v1/appointments` | `@Public()` | **10/min strict** |
| `GET` | `/api/v1/appointments` | `manageAppointments` | default |
| `GET` | `/api/v1/appointments/:id` | `manageAppointments` | default |
| `PATCH` | `/api/v1/appointments/:id` | `manageAppointments` | default |
| `POST` | `/api/v1/appointments/:id/cancel` | `manageAppointments` | default |
| `POST` | `/api/v1/appointments/:id/reprogram` | `manageAppointments` | default |

**Algoritmo de disponibilidad mensual** (en `getMonthlyAvailability`):

1. Resolver servicio por slug; leer `durationMinutes`.
2. Calcular `monthStartUtc` / `monthEndUtc` vía `localArgToUtc` (primero y último día del mes en ARG).
3. En paralelo: `availability.getEffectiveRulesForService`, `availability.getBlockedDatesInRange`, query de turnos activos (PENDING/CONFIRMED) del mes con `select: { date: true }`.
4. `Set` de `date.getTime()` tomados para lookup O(1).
5. Iterar día por día en ARG local:
   - Skip si cae en un `BlockedDate`.
   - Determinar `weekday` ARG con `utcToLocalArgParts` + `jsWeekdayToPrisma`.
   - Para cada rule del weekday: generar ticks `startMin → endMin - duration` cada `duration` minutos.
   - Convertir cada tick a UTC con `localArgToUtc`. Descartar pasados (`<= now`) y ocupados (set).
   - Ordenar slots.
6. Devolver `{ serviceSlug, durationMinutes, month, days: [{ date: "YYYY-MM-DD", slots: ["HH:MM"] }] }`. Días vacíos incluidos.

**Concurrency-safe booking** (en `create`):

```ts
await prisma.$transaction(async (tx) => {
  const conflict = await tx.appointment.findFirst({
    where: { serviceId, date, status: { in: ['PENDING', 'CONFIRMED'] } },
    select: { id: true },
  });
  if (conflict) throw new ConflictException('Ese turno ya fue tomado...');
  return tx.appointment.create({ data: ... });
}, { isolationLevel: 'Serializable' });
```

Emails encolados FUERA de la transacción (confirmación al paciente + notificación interna al negocio).

**Timezone** (en `utils/timezone.ts`):

```ts
export const CBI_TZ_OFFSET_HOURS = -3;
export function localArgToUtc(y, m, d, h, min) {
  return new Date(Date.UTC(y, m - 1, d, h - CBI_TZ_OFFSET_HOURS, min));
}
// ej: localArgToUtc(2026, 5, 10, 7, 0) → 2026-05-10T10:00:00.000Z
```

Argentina no tiene DST desde 2009 → offset fijo es 100% predecible. No se agregó `date-fns-tz` para mantener el build liviano.

**Validaciones específicas** (en `validateSlot`):

- `ts > now + 5min` (margen de clock skew entre front y back).
- El slot cae en una rule efectiva: weekday matchea, `slotMin >= startMin`, `slotMin + duration <= endMin`, `(slotMin - startMin) % duration === 0`.
- No está en un `BlockedDate` del servicio (via `availability.isDateBlockedForService`).

### 4. Pruebas ejecutadas (16 casos · todas OK)

Login admin + tests:

| # | Caso | Resultado |
|---|---|---|
| 1 | `GET /availability/clinica-humana?month=2026-05` | 200 — 31 días. Lunes 4 con 10 slots (07:00-11:30), sábado 2 con 6 slots (08:00-10:30), domingo 3 con `[]` |
| 2 | `POST` slot válido 2026-05-04 09:00 ART | 201 PENDING |
| 3 | `POST` mismo slot otra vez | **409** `"Ese turno ya fue tomado por otro paciente"` |
| 4 | `POST` lunes 13:00 ART (fuera de rule 07-12) | **400** `"No hay disponibilidad en ese horario"` |
| 5 | `POST` fecha pasada (2020-01-01) | **400** `"El turno debe agendarse a futuro"` |
| 6 | `POST` medicina-regenerativa sin `consentGiven` | **400** `"requiere consentimiento explícito"` |
| 7 | `POST` DNI "1234" (4 dígitos) | **400** validación class-validator |
| 8 | `GET /appointments` admin paginado | 200 — meta `{total:1, page:1, pageSize:10, totalPages:1}` |
| 9 | `GET /appointments` sin cookie | **401** |
| 10 | `GET /appointments/:id` admin | 200 con service incluido |
| 11 | `PATCH /:id status=CONFIRMED` | 200 — `confirmedAt` seteado automáticamente |
| 12 | Crear 2º appointment para prueba de conflict | 201 |
| 13 | `POST /:id/cancel` con reason | 200 status=CANCELLED, `cancelledAt` seteado, email encolado |
| 14 | `POST /:id/cancel` de nuevo | **409** `"El turno ya está cancelado"` |
| 15 | `POST /:id/reprogram` a nuevo slot válido | 200 — date actualizada, email encolado |
| 16 | `POST /:id/reprogram` a slot ocupado por 3er appt | **409** `"El nuevo slot ya está ocupado"` |

**AuditLog verificado:** 3 entradas (`APPOINTMENT_PATCH`, `APPOINTMENT_CANCEL`, `APPOINTMENT_REPROGRAM`). Create público no audita — ver deuda abierta.

**EmailLog verificado:** 8 entradas status SENT — 3 creates × 2 (confirmación + interno) + 1 cancel + 1 reprogram = 8. ✅

Cleanup al final: 3 appointments + 8 email logs borrados. AuditLog dejado para trazabilidad histórica.

### 5. Incidencias

1. **Port 3001 ocupado al bootear** — zombie del server de sesión 1. Resuelto con PowerShell `Get-NetTCPConnection -LocalPort 3001 | Stop-Process -Force`. Sin impacto funcional.

### Decisiones técnicas registradas

Ver memoria `project_decisions.md` para contexto completo:

1. **EmailsModule como stub** antes de B2 completo — contrato `enqueue()` estable, reemplazo no-breaking.
2. **Timezone ARG con helper local** + offset fijo `-3`, sin `date-fns-tz` (Argentina sin DST).
3. **Concurrency: transaction Serializable + re-check**, SIN partial unique index (volumen esperado no lo justifica).
4. **`AuditLog.userId` required bloquea auditar create público** — no auditamos creaciones públicas por ahora. Resolver en F2.

### Estado al cerrar la sesión

- ✅ EmailsModule stub + AppointmentsModule completos en local.
- ✅ `npm run type-check` + `npm run build` limpios al primer intento.
- ✅ 16/16 casos probados contra Neon real.
- ✅ AuditLog + EmailLog persistidos correctamente.
- ⏳ Commits + push pendientes de OK del usuario.
- ⏳ Próximo módulo: **B3 SubmissionsModule** o **B4 UsersModule admin** — orden a coordinar con el usuario.

### Deuda abierta (nueva)

- `PaginationDto` + `PaginatedResponse<T>` viven en `availability/*` y `AppointmentsModule` importa de ahí — refactor a `src/common/` pendiente.
- Audit de creaciones públicas — decisión F2 (user SYSTEM o userId opcional).
- `EmailKind` enum sin `APPOINTMENT_REPROGRAMMED` — se sumará si el cliente pide template distinto.
- Partial unique index para booking — mejora opcional si se detectan race conditions reales bajo carga.

---

## 2026-04-21 · Sesión 1 — Bootstrap + AvailabilityModule + primera push

### Contexto de entrada

Skeleton ya escrito en disco (NestJS 10 + Fastify adapter + Prisma 5.20 + Neon + auth JWT en cookies HttpOnly + catálogo de servicios + health checks) pero **sin commits en git**. Remote `origin` apuntando a GitHub configurado, sin nada pusheado.

### 1. Exploración del código

Se leyeron los archivos base para entender el patrón ya establecido:

- `package.json` — deps pinned: `@nestjs/*` 10.4.6, `@nestjs/platform-fastify` 10.4.6, `fastify` 4.28.1, `@fastify/helmet` 11.1.1 (v11 crítico por Fastify v4, NO v12), `@fastify/cors` 9.0.1, `prisma` 5.20.0, `bullmq` 5.25.4, `resend` 4.0.0, `zod` 3.23.8.
- `src/main.ts` — bootstrap con Helmet + CORS whitelist + cookies parser + ValidationPipe global + AllExceptionsFilter + TransformInterceptor + Swagger en `/api/docs` + prefix `/api` + versioning URI v1 + Pino + graceful shutdown.
- `src/app.module.ts` — ConfigModule (zod) + LoggerModule Pino + Throttler (100/min default + 10/min strict) + Schedule + Prisma + Auth + Users + Services + Health.
- `prisma/schema.prisma` — 14 modelos. 3 de NextAuth (`Account`, `Session`, `VerificationToken`) quedan como deuda para limpiar.
- `src/auth/` y `src/services/` como referencia de convenciones: `@Controller({ path, version: '1' })`, DTOs con `@ApiProperty`, respuesta `{ data, meta }` vía interceptor.

### 2. Memoria del proyecto

Se crearon archivos de memoria en `.claude/projects/c--Users-mateo-Desktop-cbi-viale-back/memory/`:

- `MEMORY.md` — índice
- `project_overview.md` — cliente, servicios, datos de contacto, tagline
- `project_stack.md` — versiones pinned con razones de compatibilidad
- `project_architecture.md` — convenciones por módulo, reglas innegociables
- `project_security.md` — auth flow, CORS, Helmet, rate limiting, audit log
- `project_modules_status.md` — roadmap dinámico 🔴🟡🟢✅
- `project_workflow.md` — commits en español, nunca push sin OK
- `user_profile.md` — Mateo Gaviraghi, senior, trabaja con dos repos paralelos

### 3. Plan de AvailabilityModule

Se propuso arrancar por **AvailabilityModule** y no por AppointmentsModule (aunque el roadmap original ponía Appointments primero) porque Availability provee los helpers internos (`getEffectiveRulesForService`, `isDateBlockedForService`, `getBlockedDatesInRange`) que Appointments necesita para calcular slots.

Plan aprobado después de explicarle al usuario la diferencia entre **override** vs **concat** con ejemplo de Medicina Regenerativa:

- **Override** (elegido): si un servicio tiene al menos una rule específica, esas reemplazan COMPLETAMENTE las globales.
- **Concat** (descartado): suma específicas + globales — no permite restringir horarios.

### 4. Implementación

**Archivos creados:**

```
src/availability/
├── availability.module.ts
├── availability.controller.ts     # 9 endpoints
├── availability.service.ts        # CRUD + helpers internos + audit inline
└── dto/
    ├── availability-filters.dto.ts    # PaginationDto + RuleFiltersDto + BlockedDateFiltersDto
    ├── create-availability-rule.dto.ts
    ├── update-availability-rule.dto.ts
    ├── create-blocked-date.dto.ts
    └── update-blocked-date.dto.ts
```

**Endpoints resultantes** (todos bajo `/api/v1/availability`):

| Método | Path | Auth | Propósito |
|---|---|---|---|
| `GET` | `/public/:serviceSlug` | `@Public()` | Reglas efectivas + bloqueos futuros para el front |
| `GET` | `/rules` | `manageAvailability` | Lista paginada de reglas (filtros: weekday, serviceSlug, active) |
| `POST` | `/rules` | `manageAvailability` | Crea regla (valida overlap) |
| `PATCH` | `/rules/:id` | `manageAvailability` | Update parcial |
| `DELETE` | `/rules/:id` | `manageAvailability` | Hard delete |
| `GET` | `/blocked-dates` | `manageAvailability` | Lista paginada (filtros: from, to, serviceSlug) |
| `POST` | `/blocked-dates` | `manageAvailability` | Crea bloqueo (warn si afecta turnos) |
| `PATCH` | `/blocked-dates/:id` | `manageAvailability` | Update parcial |
| `DELETE` | `/blocked-dates/:id` | `manageAvailability` | Hard delete |

**Validaciones clave:**

- Regex `^([01]\d|2[0-3]):[0-5]\d$` para formato HH:MM en DTO.
- `endTime > startTime` en el service (convierte a minutos).
- Overlap: `findFirst` con `startTime: { lt: newEnd }, endTime: { gt: newStart }` en el mismo scope (weekday + serviceId). Comparación de strings funciona porque `HH:MM` zero-padded ordena lexicográficamente.
- `endDate >= startDate` para bloqueos.
- `ensureServiceExists()` cuando se pasa `serviceId`.

**Audit log:** método privado `audit()` escribe a `prisma.auditLog` en cada mutación. Acciones: `AVAILABILITY_RULE_CREATE|UPDATE|DELETE`, `BLOCKED_DATE_CREATE|UPDATE|DELETE`. Refactor a `AuditLogModule` pendiente para Fase 2.

### 5. Bugs resueltos durante la implementación

1. **TS4053 al build** — `PaginatedResponse<T>` era privada pero usada como return type en métodos públicos del service. Fix: `export interface PaginatedResponse<T>`.
2. **Path del binary al bootear** — probé `node dist/main.js` pero el build genera en `dist/src/main.js` (por la estructura de tsconfig). Corregido a `dist/src/main.js`.

### 6. Pruebas ejecutadas (contra Neon real)

Login con admin del seed → guardar cookies → probar endpoints:

| # | Caso | Resultado |
|---|---|---|
| 1 | `GET /public/clinica-humana` sin auth | 200 — 6 rules del seed + blockedDates vacío |
| 2 | `GET /rules` sin cookie | 401 Unauthorized |
| 3 | `GET /rules` con admin | 200 — paginado `{total:6, page:1, pageSize:50, totalPages:1}` |
| 4 | `POST /rules` Thursday 14:00-18:00 global | 201 Created |
| 5 | `POST /rules` Thursday 15:00-17:00 (overlap) | **409 Conflict** con mensaje `"Ya existe una regla en THURSDAY 14:00–18:00 en este scope"` |
| 6 | `POST /rules` startTime "25:00" | **400 Bad Request** con error de regex |
| 7 | `POST /rules` startTime = endTime | **400** `"endTime debe ser mayor que startTime"` |
| 8 | `POST /blocked-dates` 2026-12-25 con reason "Navidad" | 201 Created |
| 9 | `GET /public/clinica-humana` re-check | Block aparece en `blockedDates` |
| 10 | `POST /blocked-dates` endDate < startDate | **400** `"endDate debe ser mayor o igual a startDate"` |
| 11 | `DELETE /rules/:id` | 200 OK |
| 12 | `DELETE /blocked-dates/:id` | 200 OK |
| 13 | `GET /rules` post-delete | total vuelve a 6 (estado seed) |

Audit log verificado — 4 entradas persistidas en DB (`AVAILABILITY_RULE_CREATE/DELETE`, `BLOCKED_DATE_CREATE/DELETE`).

### 7. Git y primera push

- Se agregó `CBI_BACK_PROMPT.md` (brief original) al `.gitignore`.
- Para tener historia limpia se hicieron dos commits en vez de uno grande. Para el primer commit se reverté temporalmente `app.module.ts` al estado sin `AvailabilityModule`, y tras el commit se restauró.

**Commits:**

```
18bbd41  feat(availability): CRUD admin + lectura publica con override semantico
7b31a91  feat: skeleton inicial del backend CBI Viale
```

Push a `origin/main` con `-u` para tracking.

### Decisiones técnicas registradas

Ver memoria `project_decisions.md` para contexto completo:

1. **Override semántico** en `getEffectiveRulesForService` (no concat).
2. **Audit log inline** en cada service de Fase 1 — se refactoriza al helper cuando exista `AuditLogModule` (Fase 2).
3. **String compare "HH:MM"** para overlap — aprovecha zero-padding y comparación lexicográfica de Postgres.
4. **Dos commits** para la primera push (skeleton + availability) — historia clara.
5. **`CBI_BACK_PROMPT.md` gitignored** — brief vive local, la verdad está en código + memoria + este MD.
6. **`PaginationDto` reusable** vía `extends` en cada filters DTO. Default `pageSize=20`, max `100`.

### Estado al cerrar la sesión

- ✅ Skeleton + Availability pusheados a GitHub.
- ✅ `npm run type-check` + `npm run build` limpios.
- ✅ Funcionalidad probada contra Neon (13/13 casos).
- ✅ Audit log funcionando.
- ⏳ Railway debería auto-deployar si el webhook está conectado — verificar en la próxima sesión.
- ⏳ Próximo módulo: **AppointmentsModule** (plan pendiente de armar).

### Deuda abierta

- Remanentes NextAuth en schema (`Account`, `Session`, `VerificationToken`) — limpiar cuando `UsersModule` admin esté andando.
- `UsersModule` sin controller todavía — agregar endpoints admin.
- Refactor `audit()` helper privado → `AuditLogModule` compartido (Fase 2).
- `/health/liveness` dio 404 en test inicial aunque la ruta aparece mapeada — investigar si causa problemas de health check en Railway. No bloqueante por ahora.

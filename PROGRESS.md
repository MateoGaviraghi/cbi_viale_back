# CBI Viale Backend — Log de Progreso

Documento vivo del avance del backend. Actualizado tras cada unidad de trabajo significativa (módulo terminado, decisión técnica, push, deploy).

> **Formato:** entradas cronológicas descendentes (más reciente arriba). Cada sesión lleva fecha, qué se hizo, decisiones tomadas, pruebas ejecutadas, commits generados y qué quedó abierto.

---

## Estado general

| Área | Estado |
|---|---|
| Skeleton (Nest + Fastify + Prisma + Auth + Services + Health) | ✅ en `main` |
| AvailabilityModule (CRUD admin + lectura pública) | ✅ en `main` |
| AppointmentsModule (turnos + algoritmo de slots ARG-tz) | ✅ en `main` |
| EmailsModule completo (BullMQ + Resend + 5 templates React Email) | ✅ en `main` |
| SubmissionsModule (B-2, CRUD público + admin + emails) | ✅ en `main` |
| UsersModule (B-3, endpoints admin con soft delete + permissions) | ✅ local · 20/20 tests · pendiente push |
| CronModule (recordatorios 24h) | 🟡 Fase 2 |
| AuditLogModule (helper + endpoints admin) | 🟡 Fase 2 |
| ExportsModule (PDF/Excel a R2) | 🟡 Fase 2 |
| AnalyticsModule (PageView + dashboard) | 🟢 Fase 3 |
| Sentry integration | 🟢 Fase 3 |
| Deploy Railway auto desde `main` | ✅ vivo en `https://cbivialeback-production.up.railway.app` |
| Front en Vercel con rewrite proxy | ✅ vivo en `https://cbi-viale-front.vercel.app` |

**Repo:** [MateoGaviraghi/cbi_viale_back](https://github.com/MateoGaviraghi/cbi_viale_back) · branch `main`.

---

## 2026-04-28 · Sesión 6 — UsersModule (B-3) · Fase 1 cerrada

### Contexto

Único módulo Fase 1 restante. Plan aprobado con 7 endpoints admin, 5 DTOs, soft delete, audit log inline. 3 decisiones del user:
1. Password reset NO invalida sesiones activas (simplicidad — deuda Fase 2 si hace falta `tokenVersion`).
2. NO endpoint self-change-password para employees (seguridad — van con admin).
3. Limpieza NextAuth pasa a B-4 separado.

### 1. Endpoints

| Método · Path | Auth | Descripción |
|---|---|---|
| `GET /users` | `manageUsers` | Lista paginada con filtros `role`, `active`, `q` (search insensitive name/email) |
| `GET /users/:id` | `manageUsers` | Detalle (sin `passwordHash`) |
| `POST /users` | `@Roles('ADMIN')` | Crea EMPLOYEE/ADMIN. Bcrypt 10 rounds. 409 email duplicado |
| `PATCH /users/:id` | `manageUsers` | Update parcial: name, email, role, active. Self-protection + last-admin guard |
| `PATCH /users/:id/permissions` | `@Roles('ADMIN')` | Reemplaza permissions completo. Whitelist server-side |
| `PATCH /users/:id/password` | `@Roles('ADMIN')` | Reset admin. Sin loguear pass. NO invalida sesiones |
| `DELETE /users/:id` | `@Roles('ADMIN')` | Soft delete (`active=false`). Idempotente |

### 2. Convenciones aplicadas

- **`PublicUser` type** = `Omit<User, 'passwordHash' | 'emailVerified' | 'image'>`. Helper `toPublicUser()` aplicado en todo response.
- **`VALID_PERMISSIONS`** const en `users.service.ts` con las 7 keys (`manageAppointments`, `manageAvailability`, `manageSubmissions`, `manageUsers`, `viewAuditLog`, `exportData`, `viewAnalytics`). Validación server-side: keys fuera tiran 400 con la lista válida en el mensaje.
- **Last-admin guard** (`ensureAdminCountAfterChange`): bloquea cualquier operación que dejaría 0 ADMINs activos (PATCH role + DELETE).
- **Self-protection**: nadie puede `active=false` ni DELETE su propio user (403).
- **Audit log inline** mismo patrón que availability/appointments/submissions: `USER_CREATE`, `USER_UPDATE` (con `changedFields`), `USER_PERMISSIONS_UPDATE` (con `before`/`after`), `USER_PASSWORD_RESET` (metadata vacía — nunca loguear password), `USER_DELETE`.

### 3. Tests funcionales · 20/20 OK contra Neon

Server local en `:3001` apuntando a Neon. Login admin del seed → batería completa:

| # | Caso | HTTP | Resultado |
|---|---|---|---|
| 1 | Login admin | 200 | role=ADMIN |
| 2 | POST crear EMPLOYEE | 201 | passwordHash NO expuesto |
| 3 | POST email duplicado | 409 | "Ya existe un registro con ese valor único" |
| 4 | POST password < 8 chars | 400 | "La password debe tener al menos 8 caracteres" |
| 5 | GET paginado | 200 | passwordHash NO en items |
| 6 | GET ?q=carla | 200 | match correcto |
| 7 | GET ?role=EMPLOYEE&active=true | 200 | filtros combinados |
| 8 | GET /:id | 200 | keys: active, createdAt, email, id, name, permissions, role, updatedAt |
| 9 | GET /inexistente | 404 | "Usuario no encontrado" |
| 10 | PATCH name | 200 | audit USER_UPDATE creado |
| 11 | PATCH email duplicado | 409 | |
| 12 | PATCH permissions con `{foo:true}` | 400 | "Permisos inválidos: [foo]. Válidos: [...]" |
| 13 | PATCH permissions con keys válidas | 200 | objeto reemplazado completo |
| 14 | PATCH password + login con nueva pass | 200 + 200 | OK |
| 15 | EMPLOYEE intenta GET /users | 403 | "No tenés los permisos necesarios" |
| 16 | DELETE al propio admin | 403 | "No podés deshabilitar tu propio usuario" |
| 17 | PATCH role=EMPLOYEE al único ADMIN | 400 | "Debe quedar al menos un administrador activo" |
| 18 | DELETE soft | 200 | active=false |
| 19 | Login con user inactivo | 401 | `verifyPassword` filtra por active |
| 20 | DELETE idempotente | 200 | sin cambios |

### 4. Audit logs verificados

5 logs persistidos en `AuditLog` (entity='User'):
- `USER_CREATE` · meta `{role, email}`
- `USER_UPDATE` · meta `{changedFields:["name"]}`
- `USER_PERMISSIONS_UPDATE` · meta `{before, after}`
- `USER_PASSWORD_RESET` · meta `{}` (nunca loguear password)
- `USER_DELETE` · meta `{email}`

### 5. Cleanup

User `qa-b3-carla@test.com` + sus 5 audit logs eliminados de Neon vía script tsx ad-hoc post-test. Server local detenido. Workspace limpio.

### Estado al cerrar sesión 6

- ✅ **Fase 1 completa**. Skeleton + Auth + Services + Health + Availability + Appointments + Emails + Submissions + Users.
- ✅ Type-check + build limpios al primer intento.
- ✅ 20/20 tests funcionales OK contra Neon.
- ⏳ Sin commits hechos. PROGRESS.md actualizado, código listo para commit + deploy.
- ⏳ Próximo: pedir OK al user para commit + push, smoke-test post-deploy en Railway.
- 📋 Backlog: **B-4 (limpieza NextAuth)** antes de Fase 2. Después CronModule, AuditLogModule, ExportsModule.

### Decisiones registradas

Ver memoria/`project_decisions.md`:
- Password reset NO invalida sesiones (Fase 2 si hace falta).
- NO self-change-password endpoint (seguridad).
- `VALID_PERMISSIONS` whitelist server-side como fuente de verdad.

---

## 2026-04-24 · Sesión 5b — QA end-to-end endpoints públicos + fix slug response + cleanup

### Contexto

Sesión 5a dejó prod estable con fix de health + cookies pusheados. User pidió QA exhaustivo de todos los endpoints públicos antes de entregar Etapa 1, validando envelope, códigos HTTP y mensajes de error contra el flow real (front Vercel via rewrite → back Railway).

### 1. Batería de 23 tests · todos verdes

| Endpoint | Caso | HTTP | Validación |
|---|---|---|---|
| `GET /services` | Lista | 200 | `{data:[...], meta:{total:6}}` |
| `GET /services/:slug` × 6 | Cada slug válido | 200 | envelope `{data:{...}}` con `requiresConsent` y `durationMinutes` correctos |
| `GET /services/no-existe` | Slug inválido | 404 | `"Servicio \"no-existe\" no existe"` |
| `GET /appointments/availability/clinica-humana?month=2026-05` | Mes válido | 200 | 31 días, 26 con slots, primer slot 07:30 |
| `POST /appointments` | Válido | 201 | turno PENDING creado, emails encolados |
| `POST /appointments` | Mismo slot (duplicado) | 409 | `"Ese turno ya fue tomado por otro paciente"` |
| `POST /appointments` | Fecha pasada | 400 | `"El turno debe agendarse a futuro"` |
| `POST /appointments` | DNI con letras | 400 | `["DNI debe tener 7 u 8 dígitos"]` |
| `POST /appointments` | Domingo (fuera rule) | 400 | `"No hay disponibilidad en ese horario para este servicio"` |
| `POST /appointments` | Medicina-regen sin consent | 400 | `"Este servicio requiere consentimiento explícito"` |
| `POST /submissions` × 4 tipos | `CONTACT_GENERAL`, `SERVICE_INQUIRY`, `CONSENT`, `CUSTOM` | 201 | `status: PENDING`, `extraData` preservada |
| `POST /submissions` | SERVICE_INQUIRY sin slug | 400 | `"type SERVICE_INQUIRY requiere serviceSlug"` |
| `POST /submissions` | Email inválido | 400 | `["Email inválido"]` |
| `POST /submissions` | Tipo inexistente `QUOTE_REQUEST` | 400 | Lista los 4 válidos |
| `POST /submissions` | Prop extra `malicious_field` | 400 | Whitelist rechaza |

### 2. Discrepancia detectada y fixeada · `slug` en response

`GET /services` devolvía `slug: "CLINICA_HUMANA"` (enum Prisma) pero el endpoint acepta `"clinica-humana"` (kebab). Regla del API: input y output deben usar el mismo formato.

**Fix en [`src/services/services.service.ts`](src/services/services.service.ts):**
- Mapa inverso `ENUM_TO_SLUG: Record<ServiceSlug, string>`.
- Helper `toPublicService()` que mapea `slug` enum → kebab.
- Tipo público `PublicService = Omit<Service, 'slug'> & { slug: string }`.
- `listActive()` y `findBySlugOrThrow()` devuelven `PublicService`.

Grep confirmó que ningún consumer interno usa `.slug` del objeto devuelto — solo `.id`, `.durationMinutes`, `.requiresConsent`. Cambio safe en runtime, type-check limpio.

### 3. Discrepancia descartada · throttler comparte IP via Vercel proxy

Hipótesis inicial: como el back recibe requests desde la IP de Vercel (proxy rewrite), el contador del throttler agruparía a todos los usuarios.

**Verificado:** `@nestjs/throttler` usa `req.ip` del adapter Fastify, y `trustProxy: true` en [`main.ts:29`](src/main.ts#L29) hace que Fastify lea `X-Forwarded-For`. El chain `Browser → Vercel edge → Railway edge → Fastify` apila IPs correctamente y `req.ip` resuelve a la IP real del cliente. NO hay bug. NO hay fix necesario.

### 4. Corrección de memoria · `FormType` tiene **4** valores, no 2

Mi memoria decía `FormType = { CONTACT_GENERAL, SERVICE_INQUIRY }`. El enum Prisma real tiene **4**: `CONTACT_GENERAL`, `SERVICE_INQUIRY`, `CONSENT`, `CUSTOM`. Descubierto en el test 10 cuando envié un tipo inválido y el error listó los válidos. `project_modules_status.md` actualizado.

### 5. Discrepancia documentada (NO requiere fix) · `message` string vs array

- Errores de negocio del service: `message: string` (`"El turno debe agendarse a futuro"`)
- Errores de class-validator: `message: string[]` (`["Email inválido"]`)

Es comportamiento estándar de Nest. El front debe hacer `Array.isArray(msg) ? msg.join(', ') : msg`. Documentar en el onboarding del dev del front.

### 6. Cleanup de data QA

Via admin API:
- Login como `admin@cbiviale.com.ar`.
- `POST /appointments/:id/cancel` → 1 appointment CANCELLED.
- `PATCH /submissions/:id` × 4 → 4 submissions ARCHIVED.
- Verificado: 0 PENDING con `email=qa-endtoend@test.com`.

EmailLog dejado intacto (trazabilidad). Emails reales recibidos en `mateogaviraghi24@gmail.com` (Resend sandbox solo envía al owner — limitación conocida hasta DNS de `cbiviale.com.ar`).

### 7. Rate limiting · validado en los 3 endpoints públicos críticos

Curl-loop contra prod, 3 tests con esperas de 65s entre cada uno para que el contador se libere:

| Endpoint | Config | Loop ejecutado | Resultado |
|---|---|---|---|
| `POST /submissions` | strict 10/min | × 11 con body `{}` | reqs 1–10 → 400, `x-ratelimit-remaining-strict` 9→0, req 11 → 429 ✅ |
| `POST /appointments` | strict 10/min | × 11 con body `{}` | idéntico · req 11 → 429 ✅ |
| `POST /auth/login` | strict 5/min | × 6 con creds inválidas | reqs 1–5 → 401, req 6 → 429 ✅ |

**Confirmado:**
- El guard `Throttle` corre **antes** de `ValidationPipe` — cuerpos inválidos también consumen el slot del strict-counter (protege contra spam con basura).
- Header `x-ratelimit-remaining-strict` expuesto en cada response. El front puede leerlo para feedback.
- Shape del 429: `{ statusCode:429, message:"ThrottlerException: Too Many Requests", error, path, timestamp }` consistente con el resto.
- Tracker por IP real del cliente (validado en sección 3 vía `trustProxy:true` + `X-Forwarded-For`).

### 8. Discrepancia menor detectada · cold start de Neon

En el primer request del test C, el back devolvió **400** con mensaje técnico de Prisma:
```
"Please make sure your database server is running at ep-blue-queen..."
```
Es un cold start de Neon (auto-suspend del plan free después de inactividad). El siguiente request (~2s después) ya estaba caliente.

**Opciones evaluadas:**
1. Ignorar — raro con tráfico real constante.
2. Migrar a Neon plan paid (sin auto-suspend) — costo recurrente.
3. Capturar `PrismaClientInitializationError` en `AllExceptionsFilter` → 503 genérico `"Servicio temporalmente no disponible, reintentar"`. ~10 líneas, defensa en profundidad.

**Decisión:** anotada como deuda Fase 2 (decidir con el user). NO bloqueante para Etapa 1.

### Estado al cerrar sesión 5b

- ✅ 23/23 tests públicos OK contra prod.
- ✅ Rate limiting validado en `/submissions`, `/appointments`, `/auth/login`.
- ✅ Slug kebab-case consistente input/output.
- ✅ Throttler confirmado (usa IP real del cliente).
- ✅ Memoria actualizada con los 4 `FormType` reales.
- ✅ Data QA limpiada.
- ⏳ Commit + push del fix slug + docs pendiente de OK del user.
- ⏳ Próximo: **B-3 UsersModule endpoints admin** (último módulo de Fase 1).
- 📋 Backlog Fase 2: capturar `PrismaClientInitializationError` para enmascarar cold-starts de Neon como 503 amigable.

### Decisiones registradas

Ver [memoria/project_decisions.md](.claude/projects/.../memory/project_decisions.md):
- `toPublicService()` + `ENUM_TO_SLUG` — regla general: formato de entrada y salida debe coincidir. Enum Prisma es detalle de implementación.

---

## 2026-04-24 · Sesión 5 — Deploy prod Railway+Vercel end-to-end + fix health + fix cookies

### Contexto de entrada

Sesión 4 (Submissions + refactor de tipado de emails) pusheada en `1d99c13`. El back estaba desplegado en Railway (`cbivialeback-production.up.railway.app`) y el front en Vercel (`cbi-viale-front.vercel.app`) pero sin verificar end-to-end. El user pidió auditar configs y hacer las pruebas.

### 1. Auditoría de env vars · higiene de secrets

Detectado en Vercel: el front tenía **24 env vars del back** (`JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `RESEND_*`, `REDIS_*`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `CRON_SECRET`, `COOKIE_*`, `CORS_ORIGINS`, `BUSINESS_NOTIFICATION_EMAIL`, etc.). Verificado via `grep` en el código del front que **ninguna** se referencia — solo aparecen en docs (`TAREAS.md`, `PLAN.md`). El front usa únicamente `API_URL` (destino del rewrite Next) y `NEXT_PUBLIC_SITE_URL` (SEO).

**Resultado:** lista de purga entregada al user (24 vars a borrar), confirmado que son 100% residuo del scaffold inicial + remanentes de NextAuth. Retracté una recomendación temprana (`COOKIE_SAMESITE=none`) al darme cuenta que el front usa rewrites Next → para el browser todo es mismo-origen → `SameSite=Lax` actual alcanza.

### 2. Bug crítico · `Domain=localhost\t` en `Set-Cookie` prod

Al testear login directo en `cbivialeback-production.up.railway.app/api/v1/auth/login` el back devolvía 200 con user correcto, pero el header `Set-Cookie` salía con `Domain=localhost\t; Path=/; HttpOnly; Secure; SameSite=Lax` — tab invisible pegado al valor (copy-paste desde el `.env` local al dashboard de Railway lo metió).

Efecto: el código hacía `domain === 'localhost' ? undefined : domain`. Como el valor real era `'localhost\t'`, la comparación strict fallaba y Fastify escribía `Domain=localhost` literal en el header. Browser rechaza silenciosamente (domain no matchea el host real) → sesión nunca se guarda → 401 en siguientes requests.

**Fix [`src/auth/auth.service.ts`](src/auth/auth.service.ts):** helper privado `resolveCookieDomain()` que aplica `.trim()` al raw value y trata `'localhost'` **y string vacío** como `undefined` (cookie host-only del dominio del request, que es lo que queremos cross-domain). `attachAuthCookies` y `clearAuthCookies` comparten el helper. Defensa en profundidad: aunque Railway meta whitespace de vuelta, el código lo neutraliza.

### 3. Deuda cerrada · `/health/liveness` y `/health/readiness` devolvían 404

Arrastrado desde sesión 1. El `main.ts` tenía `setGlobalPrefix('api', { exclude: ['health', 'health/liveness', 'health/readiness'] })` pero `enableVersioning({ type: URI, defaultVersion: '1' })` aplicaba a **todos** los controllers sin versión declarada — los health quedaban en `/v1/health/*` en vez de `/health/*`. Railway / K8s apuntan sus probes a rutas fijas sin versionar, así que este 404 era bug real no bloqueante.

**Fix [`src/health/health.controller.ts`](src/health/health.controller.ts):** `@Controller({ path: 'health', version: VERSION_NEUTRAL })`. Sale del URI versioning sin tocar los endpoints de negocio.

### 4. Commits + push

```
3a4d9ad  fix(health): expone /health/liveness y /readiness sin prefijo de version
6255204  fix(auth): normaliza COOKIE_DOMAIN trimeando whitespace
```

Railway redeployó en 27s.

### 5. Tests post-deploy (5/5 OK)

| Test | URL | Resultado |
|---|---|---|
| Liveness sin `/v1/` | `cbivialeback-.../health/liveness` | 200 · `{status:"ok", ts}` |
| Readiness con ping Neon | `cbivialeback-.../health/readiness` | 200 · `neon_db: up` |
| Services catálogo público | `cbivialeback-.../api/v1/services` | 200 · 6 servicios |
| Services via rewrite Vercel | `cbi-viale-front.vercel.app/api/v1/services` | 200 · mismo JSON |
| Login directo al back | `POST /api/v1/auth/login` | 200 · cookies **sin** `Domain=` (host-only ✓) |
| Login via rewrite Vercel | `cbi-viale-front.vercel.app/api/v1/auth/login` | 200 · cookies idénticas |

Verificado que el `Set-Cookie` final sale:
```
access_token=...; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Lax
refresh_token=...; Max-Age=604800; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax
```

### Decisiones técnicas registradas

Ver `project_decisions.md`:
- Health fuera de URI versioning via `VERSION_NEUTRAL` (no cambiar a `defaultVersion: VERSION_NEUTRAL` global porque romperíamos el prefix `v1` del resto).
- `resolveCookieDomain()` helper como única fuente de verdad del dominio de cookies — trim + 'localhost' y '' como undefined. Se eligió mantener `COOKIE_DOMAIN` string para permitir override futuro (custom domain Railway, cbiviale.com.ar post-DNS) sin otro deploy.
- Front Vercel queda con 2 env vars nada más (`API_URL` + `NEXT_PUBLIC_SITE_URL`). Todo secreto vive solo en Railway.

### Estado al cerrar sesión 5

- ✅ Back y front vivos en prod, comunicándose via rewrite Next.
- ✅ Cookies HttpOnly+Secure+Lax funcionando cross-deploy (rewrite deja el browser en mismo-origen).
- ✅ Deuda histórica del `/health/liveness` cerrada.
- ✅ Higiene de secrets hecha en Vercel (24 vars a purgar identificadas, el user las borra).
- ⏳ **Pendiente user:** completar la purga en Vercel + setear las 3 vars nuevas en Railway (`COOKIE_DOMAIN=localhost` limpio, `CRON_SECRET` nuevo random, `SWAGGER_PASSWORD`).
- ⏳ Próximo: **B-3 UsersModule endpoints admin** — último módulo de Fase 1.

### Deuda nueva

- **Ninguna técnica.** Solo el TODO operativo del user de terminar de limpiar Vercel.
- Nota: si en el futuro se agrega un custom domain `api.cbiviale.com.ar`, setear `COOKIE_DOMAIN=api.cbiviale.com.ar` (literal, sin whitespace) y el helper lo pasa tal cual. Si front y back comparten dominio padre (`cbiviale.com.ar`), podría usarse `COOKIE_DOMAIN=.cbiviale.com.ar` para compartir cookies — decidir en Fase 4 post-DNS.

---

## 2026-04-23 · Sesión 4 — SubmissionsModule (B-2) + refactor tipado emails

### Contexto de entrada

Sesión 3 (EmailsModule real) pusheada con hotfix `a966e33` del bug de variant en INTERNAL_NOTIFICATION. User confirmó queue mode E2E funcionando en prod. Pidió B-2 en paralelo con un requisito claro: bundlear el refactor de tipado de emails en la misma sesión para que el mismo tipo de bug (discriminador faltante en payload) no vuelva a aparecer al escribir el callsite de INTERNAL_NOTIFICATION variant=submission.

### 1. Plan aprobado

- SubmissionsModule con 4 endpoints (POST público throttle 10/min, GET/GET-by-id/PATCH admin con `manageSubmissions`).
- DTOs: create (con validaciones SERVICE_INQUIRY requiere serviceSlug, extraData <10KB), update (solo status), filters (type/status/serviceSlug/dateFrom/dateTo/q).
- Service con auto-seteo de `answeredAt`/`answeredBy` en primera transición a ANSWERED (idempotente).
- Audit log `SUBMISSION_PATCH` con `{fromStatus, toStatus}`.
- Emails: `FORM_RECEIPT` al submitter + `INTERNAL_NOTIFICATION variant:submission` al negocio.
- 3 preguntas resueltas: notas internas como deuda (columna no existe), CONSENT tratado genérico por ahora, no agregar dedup (throttle global alcanza).

### 2. Refactor · `EmailEnqueueParams` discriminado por `kind`

**Antes:**
```ts
interface EmailEnqueueParams {
  kind: EmailKind
  to: string
  subject: string
  payload: Record<string, unknown>   // ← loose typing que dejó pasar el bug de variant
}
```

**Después:**
```ts
interface BaseEnqueueParams { to: string; subject: string; appointmentId?: string }

export type EmailEnqueueParams =
  | (BaseEnqueueParams & { kind: 'APPOINTMENT_CONFIRMATION'; payload: AppointmentConfirmationProps })
  | (BaseEnqueueParams & { kind: 'APPOINTMENT_CANCELLED';    payload: AppointmentCancelledProps })
  | (BaseEnqueueParams & { kind: 'APPOINTMENT_REMINDER_24H'; payload: AppointmentReminder24hProps })
  | (BaseEnqueueParams & { kind: 'FORM_RECEIPT';             payload: FormSubmissionReceiptProps })
  | (BaseEnqueueParams & { kind: 'INTERNAL_NOTIFICATION';    payload: InternalNotificationProps })
```

**Impacto:**
- **Processor dispatch** ahora type-safe: `switch (data.kind)` narrow `data.payload` al tipo exacto. Sin `as never`.
- **Callsites de AppointmentsService limpiados**: los payloads incluían `appointmentId` que no estaba en ningún `<Kind>Props`. Removido (queda en top-level `BaseEnqueueParams.appointmentId` para `EmailLog.appointmentId`).
- **Bug latente descubierto**: `reprogram()` encolaba `payload: { newDate: dto.date, oldDate, ... }`, pero `AppointmentConfirmationProps` tiene `{ date, oldDate? }`. Sin el refactor, el email de reprogram mostraba la fecha vieja (template ignora `newDate` y usa `props.date`, que no estaba seteado). Fix en el mismo commit: `payload: { date: dto.date, oldDate, reprogrammed: true }`. El TS narrowing hubiera cazado el bug si hubiéramos tenido tipado desde el día 1.
- **Limitación TS conocida** al spread de unions discriminados: `{emailLogId, ...params}` pierde la correlación kind↔payload. Resuelto con `as EmailJobData` contenido + comentario en `EmailsService.enqueue`. El cast es seguro por construcción (params ya pasó el type check al entrar).

### 3. Implementación · SubmissionsModule

**Archivos creados (6):**

```
src/submissions/
├── submissions.module.ts
├── submissions.controller.ts
├── submissions.service.ts
└── dto/
    ├── create-submission.dto.ts
    ├── update-submission.dto.ts
    └── submission-filters.dto.ts
```

**Endpoints resultantes** (todos bajo `/api/v1/submissions`):

| Método | Path | Auth | Throttle |
|---|---|---|---|
| `POST` | `/` | `@Public()` | **10/min strict** |
| `GET` | `/` | `manageSubmissions` | default |
| `GET` | `/:id` | `manageSubmissions` | default |
| `PATCH` | `/:id` | `manageSubmissions` | default |

**`SubmissionsService.create` flow:**

1. Si `type === 'SERVICE_INQUIRY'` y no hay `serviceSlug` → 400.
2. Si hay `serviceSlug` → `services.findBySlugOrThrow()` (heredan 404 si inválido/inactivo).
3. Chequear `JSON.stringify(extraData).length < 10_000` bytes.
4. `prisma.formSubmission.create` con status PENDING.
5. Encolar `FORM_RECEIPT` al submitter + `INTERNAL_NOTIFICATION variant:submission` a `BUSINESS_NOTIFICATION_EMAIL` (si está seteado).

**`SubmissionsService.update`:**
- PATCH vacío → noop, devuelve existing.
- `status === 'ANSWERED'` Y `existing.status !== 'ANSWERED'` → setea `answeredAt: now, answeredBy: userId`.
- Re-patch a ANSWERED es idempotente (no re-escribe timestamp). Preserva histórico.
- Audit log en toda mutación (incluso idempotente, para trazar intentos).

### 4. Pruebas · 16/16 OK

Login admin + tests contra Neon + Redis local + Resend:

| # | Check | Resultado |
|---|---|---|
| 1 | POST CONTACT_GENERAL a `mateogaviraghi24@gmail.com` | 201 PENDING |
| 2 | POST SERVICE_INQUIRY sin serviceSlug | **400** "type SERVICE_INQUIRY requiere serviceSlug" |
| 3 | POST SERVICE_INQUIRY con `clinica-humana` | 201 con serviceId seteado |
| 4 | POST slug inválido "servicio-inexistente" | **404** "Servicio ... no existe" |
| 5 | POST email inválido "not-an-email" | **400** "Email inválido" |
| 6 | POST con `extraData.note` de 11000 chars | **400** "extraData excede el tamaño máximo (10KB stringified)" |
| 7 | GET admin paginado `?pageSize=5` | 200 · `meta:{total:5, page:1, totalPages:1}` |
| 8 | GET admin `?type=SERVICE_INQUIRY` | 200 · `total:2`, todos matchean tipo |
| 9 | GET admin `?q=pedro` (case-insensitive) | 200 · `total:2` |
| 10 | GET `/:id` admin | 200 · con service included |
| 11 | PATCH `status=ANSWERED` | 200 · `answeredAt` seteado, `answeredBy=userId`, AuditLog |
| 12 | PATCH `status=ANSWERED` otra vez | 200 · `answeredAt` **NO** cambia (idempotente) |
| 13 | PATCH `status=ARCHIVED` | 200 · AuditLog |
| 14 | GET admin sin cookie | **401** |
| 15 | **Queue mode E2E real** con Resend | 6 SENT a owner con providerIds · 2 FAILED a no-owner (sandbox limit) |
| 16 | Render tests locales | variant submission ✅ · variant appointment regresión ✅ · FormSubmissionReceipt ✅ |

**Bonus del test 15**: sandbox de Resend sin dominio verificado rejecta sends a emails no-owner con "You can only send testing emails to your own email address". El email interno al negocio (owner) llegó siempre. El receipt al submitter (no-owner) falló con 3 attempts → EmailLog FAILED — valida el retry path orgánicamente. Se resuelve cuando Fase 4 verifique el dominio `cbiviale.com.ar`.

**Audit log verificado**: 3 `SUBMISSION_PATCH` entries con metadata `{fromStatus, toStatus}`:
- `{PENDING → ANSWERED}` — primera transición
- `{ANSWERED → ANSWERED}` — re-patch idempotente (timestamp preservado, auditado igual)
- `{ANSWERED → ARCHIVED}`

**Cleanup**: 10 EmailLog + 5 FormSubmission borrados.

### 5. Incidente sin impacto

Mientras arrancaba tests, Redis container estaba apagado (Docker Desktop cerrado entre sesiones). POST quedó colgado en `ECONNREFUSED 127.0.0.1:6379`. User reinició Docker, container levantó, PONG OK, seguí. Sin efecto en código.

### Decisiones registradas

Ver memoria `project_decisions.md`:

1. **Refactor tipado aplicado** — la deuda de sesión 3 resuelta. Incluyó fix del bug latente de `newDate` en reprogram.
2. **`as EmailJobData` en enqueue** — cast contenido por limitación TS al spread de unions discriminados.
3. **Union simple sin genéricos** — `enqueue<K extends EmailKind>(Extract<...>)` no suma en DX vs `enqueue(params: EmailEnqueueParams)` con narrow.

### Estado al cerrar

- ✅ SubmissionsModule completo + refactor de tipado aplicado.
- ✅ 16/16 checks, queue mode E2E validado, 3 render tests.
- ⏳ 3 commits listos, pendientes de OK del user para pushear a Railway.
- ⏳ Próximo: **B-3 UsersModule endpoints admin** — único módulo Fase 1 restante.

### Deuda nueva

- Sandbox Resend solo permite envío al owner hasta que se verifique el dominio `cbiviale.com.ar` (Fase 4). En prod hoy: emails internos al negocio OK, receipts al submitter fallan silenciosamente (3 attempts + EmailLog FAILED). El front debería saberlo para no prometerle al user "te llegó un email" en el UI de éxito.

---

## 2026-04-22 · Sesión 3 — EmailsModule real (B-1 del PLAN)

### Contexto de entrada

Sesión 2 pusheada a `main` (`0949773` + `335d7fc`). Front ya alineado como cliente puro. PLAN.md sección B-1 dice: reemplazar stub por BullMQ queue + worker + React Email templates + Resend, manteniendo el contrato `EmailsService.enqueue()` estable.

**Setup local entregado:**
- Docker Redis en `0.0.0.0:6379` (container `cbi-redis`)
- `RESEND_API_KEY` real de sandbox (`re_***QjV`, free tier 100/día)
- `RESEND_FROM_EMAIL="CBI Viale Dev <onboarding@resend.dev>"` (sandbox, sin DNS propio todavía)
- Inbox de prueba: `mateogaviraghi24@gmail.com` (owner Resend, única verificada en sandbox)

### 1. Plan aprobado

Estructura dual-mode decidida por presencia de `RESEND_API_KEY`:
- **Direct** (key vacía): log Pino + `EmailLog` SENT inmediato, sin tocar Redis
- **Queue** (key seteada): `EmailLog` QUEUED + BullMQ add → worker consume → render → Resend → update SENT/FAILED

3 commits planificados: deps + tsconfig, feat(emails) completo, docs PROGRESS.md.

### 2. Commit 1 · deps + tsconfig (hash `75047ef`)

Ya pusheado previamente junto a sesión 2 preparando B-1.

Deps agregadas:
- `@nestjs/bullmq 10.2.3` (prod) — wrapper oficial Nest 10 para BullMQ con DI + `@Processor`
- `react 19.2.5` (prod) — peer dep de `@react-email/render`
- `@types/react 19.2.2` (dev) — tipado JSX
- `react-email 3.0.2` (dev) — CLI `email dev` para preview de templates

**Bug de instalación resuelto:** intenté inicialmente React 18.3.1. Fallo ERESOLVE: `react-email` CLI jala `react-dom 19.2.5` como transitiva, y ese `react-dom` requiere `react@^19.2.5`. Alineé todo en React 19. `@react-email/render 1.0.1` soporta ambos (`peer react@^18 || ^19`).

`tsconfig.json` recibió `"jsx": "react-jsx"` para compilar `.tsx` sin import explícito de React.

### 3. Resolución de `.env` duplicado

Al arrancar pruebas detecté 2 líneas duplicadas de `REDIS_URL` y `BUSINESS_NOTIFICATION_EMAIL` en `.env`. Node `--env-file` toma la última, con lo cual `BUSINESS_NOTIFICATION_EMAIL` resolvía a `contacto@cbiviale.com.ar` — dominio sin DNS todavía, bloqueado por Resend sandbox (solo permite envío al owner de la cuenta).

Usuario confirmó dedup (opción B). Lo hice: quité la línea duplicada de `REDIS_URL` (mismo valor) y la stale de `BUSINESS_NOTIFICATION_EMAIL`, dejando `mateogaviraghi24@gmail.com` (misma inbox que `RESEND_REPLY_TO`). Cuando el dominio se registre en Fase 4, se cambia a `contacto@cbiviale.com.ar`.

### 4. Implementación · EmailsModule real

**Archivos creados (11):**

```
src/emails/
├── emails.constants.ts              # EMAIL_QUEUE_NAME = 'emails', EMAIL_JOB_NAME = 'send'
├── emails.types.ts                  # EmailJobData, EmailEnqueueParams
├── emails.module.ts                 # ← reemplaza stub
├── emails.service.ts                # ← reemplaza stub (dual mode)
├── emails.processor.ts              # Worker BullMQ + render + Resend
└── templates/
    ├── utils.ts                     # formatDateArg con Intl + timeZone ARG
    ├── styles.ts                    # paleta CBI (cyan/slate) + CSSProperties tipados
    ├── components/
    │   ├── Layout.tsx               # header branding + footer con dirección/horarios
    │   └── InfoRow.tsx              # label/value reusable con strikethrough opcional
    ├── appointment-confirmation.tsx # con prop reprogrammed para reuso en create/reprogram
    ├── appointment-cancelled.tsx
    ├── appointment-reminder-24h.tsx # placeholder para B-5 CronModule
    ├── form-submission-receipt.tsx  # placeholder para B-2 SubmissionsModule
    └── internal-notification.tsx    # union discriminado appointment|submission
```

**EmailsModule setup:**
```ts
BullModule.forRootAsync({
  useFactory: (config) => {
    const url = new URL(config.get('REDIS_URL'))
    return {
      connection: {
        host: url.hostname,
        port: Number(url.port) || 6379,
        username: url.username || undefined,
        password: url.password || undefined,
        maxRetriesPerRequest: null, // requerido por BullMQ
      },
    }
  },
}),
BullModule.registerQueue({
  name: EMAIL_QUEUE_NAME,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 86_400 },    // 24h
    removeOnFail: { age: 604_800 },       // 7d
  },
}),
```

**EmailsService (dual mode):**
```ts
const apiKey = config.get('RESEND_API_KEY')
this.isDirectMode = !apiKey || apiKey.trim() === ''

async enqueue(params) {
  const log = await prisma.emailLog.create({
    data: { ...params, status: isDirectMode ? 'SENT' : 'QUEUED', ... }
  })
  if (this.isDirectMode) {
    this.logger.log({ event: 'email.direct', ... })
    return
  }
  await this.queue.add(EMAIL_JOB_NAME, { emailLogId: log.id, ...params })
}
```

**EmailsProcessor:**
- `@Processor(EMAIL_QUEUE_NAME, { concurrency: 5 })`
- En `process(job)`: renderiza template con `createElement(Component, payload) + render()`, despacha con `resend.emails.send()`, update EmailLog.
- Si Resend devuelve error: throw → BullMQ retry. Solo marca EmailLog FAILED en el último attempt (`attemptsMade >= attempts`).
- Dispatch por kind:
  ```ts
  switch (kind) {
    case 'APPOINTMENT_CONFIRMATION': return render(createElement(AppointmentConfirmation, payload as never))
    case 'APPOINTMENT_CANCELLED':    return render(createElement(AppointmentCancelled,    payload as never))
    // ...
  }
  ```

**Templates:** cada uno exporta `default` + `.PreviewProps` fixtures para `email dev`. El Layout centraliza branding; InfoRow estandariza pares label/value. Paleta cyan `#0e7490` (brand) + slate para texto.

**`npm run emails:dev`:** ejecuta `email dev --dir src/emails/templates --port 3010`.

### 5. Pruebas ejecutadas (5/5 OK)

| # | Check | Resultado |
|---|---|---|
| 1 | `npm run type-check` + `npm run build` | ✅ limpios al primer intento |
| 2 | **Queue mode E2E** (`.env` con API key real) | ✅ boot "Modo QUEUE" → POST appointment → Worker procesa 2 jobs → **2 emails reales llegan a `mateogaviraghi24@gmail.com`** (APPOINTMENT_CONFIRMATION + INTERNAL_NOTIFICATION) → `EmailLog` SENT con providerId Resend `0680e097-e53e-493c-a7fb-ab3493991e2b` y `d0fb94b0-e3fa-4884-a062-1fccf2d4992d` |
| 3 | **Direct mode** (override `RESEND_API_KEY=""`) | ✅ boot "Modo DIRECT" → POST → 2× `EmailLog` SENT inmediato SIN providerId + log Pino `event: email.direct`, no se tocó Redis |
| 4 | **Retry path** (`RESEND_API_KEY="re_invalid_..."`) | ✅ 3 attempts visibles en logs con `event: email.attempt_failed` (attemptsMade 1/2/3), backoff ~2s/4s/8s → `EmailLog` FAILED con `error: "Resend error: API key is invalid"` |
| 5 | `npm run emails:dev` | ✅ React Email 3.0.2 ready en 0.3s → `localhost:3010` HTTP 200, preview server sirviendo templates |

### 6. Cleanup post-tests

- 3 appointments borrados (queue mode test + direct mode test + retry test)
- 6 EmailLog asociados a appointments borrados
- AuditLog de sesión 2 preservado (3 entries)

### Decisiones técnicas registradas

Ver memoria `project_decisions.md` para contexto completo:

1. **Dual mode automático por RESEND_API_KEY** — sin feature flag explícito. Una sola fuente de verdad (presencia de la key) evita inconsistencias.
2. **React 19 alineado con react-email CLI** — no 18. Evita ERESOLVE y unifica lo que corre en dev (CLI) con lo que usa el processor (render).
3. **Reutilizamos la decisión de sesión 2**: stub → completo sin cambios de contrato confirma que el contrato `enqueue()` era estable.

### Estado al cerrar la sesión

- ✅ EmailsModule completo con dual mode funcionando end-to-end contra servicios reales (Neon + Redis local + Resend API).
- ✅ 5 templates React Email rendereando HTML válido.
- ✅ `AppointmentsService` callsites intactos (dual mode transparente).
- ⏳ Commits 2 (feat) + 3 (docs) push pendientes de Railway preparado con Redis addon + env vars.
- ⏳ Próximo: **B-2 SubmissionsModule** (2-3 hs) y **B-3 UsersModule admin** (2 hs, paralelizable con B-2).

### Deuda abierta (nueva)

- `EmailKind` enum sin `APPOINTMENT_REPROGRAMMED` — reprogram reusa `APPOINTMENT_CONFIRMATION` con `payload.reprogrammed: true`. Para métricas, idealmente agregar enum value o columna `metadata` en `EmailLog`. Deuda chica para B-5 o post-B-3.
- `tsconfig.json` tiene `jsx: react-jsx` global — sin efectos negativos hasta ahora, pero si aparecen errores raros, considerar `tsconfig.emails.json` aparte.

### Fix post-push · Railway bloqueado por CVE en `next@14.2.10` (transitiva de `react-email`)

Primer deploy a Railway (`d55b05ec`) falló en el gate de seguridad: `next@14.2.10` tiene 2 CVEs HIGH (GHSA-mwv6-3258-q52c y GHSA-5j59-xgg2-r9c4) fijos en 14.2.35. Next entró al lock file como transitiva de `react-email@3.0.2` — el CLI está construido sobre Next.js.

**Fix aplicado:** `npm uninstall react-email`. El CLI era solo para preview local (design-time). El render productivo usa `@react-email/render` + `@react-email/components` (prod deps) que no traen Next.

Script `emails:dev` cambió a `npx react-email@latest dev --dir src/emails/templates --port 3010` — `npx` descarga on-demand, no contamina `node_modules` ni el lock. Alternativa: instalar globalmente con `npm install -g react-email`.

**Verificado:** `node_modules/next` desapareció del lock file. type-check + build limpios post-uninstall.

Trade-off aceptado: primera ejecución de `npm run emails:dev` tarda un poco más (descarga `react-email` y sus ~50MB de deps a cache de npx). Subsecuentes usan cache. A cambio, el deploy productivo queda sin `next` ni ~200 transitivas Next-related, y futuros CVEs de Next no bloquean Railway.

### Bugfix post-deploy · `INTERNAL_NOTIFICATION` renderiza branch equivocado

Deploy de Railway en prod subió OK, emails fluyen end-to-end, pero el user detectó que el email interno al negocio (`INTERNAL_NOTIFICATION` variant `appointment`) mostraba el header "Nueva consulta desde el sitio" y campos vacíos (TIPO, NOMBRE, MENSAJE) en vez del bloque de appointment.

**Causa:** `AppointmentsService.create` encolaba `INTERNAL_NOTIFICATION` con un payload que NO incluía `variant: 'appointment'`. El template `InternalNotification` tiene un discriminated union `{variant: 'appointment' | 'submission'}`, y en JS `undefined !== 'appointment'` hace que el `if (props.variant === 'appointment')` evalúe falso y caiga al branch submission (default).

**Fix:** agregado `variant: 'appointment'` al payload. Verificado localmente con render directo: el HTML generado contiene "Nuevo turno agendado" + DNI + paciente, y NO contiene "Nueva consulta desde el sitio".

**Raíz del problema:** `EmailEnqueueParams.payload` está tipado como `Record<string, unknown>` (loose). El discriminador `variant` se pierde al pasar por esa puerta. Deuda: reemplazar `EmailEnqueueParams` por un union discriminado por `kind` que fuerce el shape del payload en compile-time. Así este tipo de bug no vuelve a pasar.

El email al paciente (`APPOINTMENT_CONFIRMATION`) no tenía este problema — su template no es un discriminated union.

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

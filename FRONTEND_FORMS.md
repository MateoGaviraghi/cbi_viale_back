# FRONTEND_FORMS — CBI Viale

Especificación de los formularios públicos del sitio.

Estos son los **7 formularios públicos** que se manejan actualmente, basados en el documento `FORMULARIOS-SERVICIOS.docx` que pasó el cliente:

1. Clínica Humana
2. Urocultivo (subform de Clínica Humana)
3. Exudado Vaginal (subform de Clínica Humana)
4. Veterinaria
5. Agro y Alimentos
6. Ambiental
7. Genética

Cada uno tiene su propio endpoint, payload y validaciones. Todo lo necesario para conectar el front está en este documento.

---

## Configuración base

**Base URL:**
- Desarrollo: `http://localhost:3001`
- Producción: `https://<railway-domain>`

**Versión de la API:** `v1` — todos los endpoints viven bajo `/api/v1/...` (prefijo global `/api` + URI versioning).

**Headers obligatorios (todas las requests):**
```
Content-Type: application/json
Accept: application/json
```

**Auth:** los endpoints de formularios son **públicos** (sin cookie JWT). El usuario que llena el form no está logueado.

**Rate limiting:**
- Formularios: **10 requests / 60 s por IP**.
- Firmar upload (Cloudinary): **5 requests / 60 s por IP**.
- En caso de exceso, el server responde `429 Too Many Requests`.

**Formato de respuesta exitosa** (todas las creaciones devuelven el `FormSubmission` completo):
```json
{
  "data": {
    "id": "ckxxx...",
    "type": "CLINICAL",
    "serviceId": "ckyyy...",
    "parentSubmissionId": null,
    "name": "María López",
    "email": "maria@example.com",
    "phone": "+5493434567890",
    "subject": null,
    "message": "Solicitud de análisis clínico\n\nObservaciones: ...",
    "consentGiven": true,
    "extraData": { /* campos específicos del formulario */ },
    "status": "PENDING",
    "answeredAt": null,
    "answeredBy": null,
    "createdAt": "2026-05-15T10:30:00.000Z",
    "updatedAt": "2026-05-15T10:30:00.000Z"
  }
}
```

**Formato de error** (cualquier 4xx / 5xx):
```json
{
  "statusCode": 400,
  "message": "DNI inválido (7-9 dígitos)",
  "error": "Bad Request"
}
```
- `400 Bad Request` — validación falló (revisar `message`).
- `404 Not Found` — `parentSubmissionId` no existe.
- `429 Too Many Requests` — rate limit.

---

## Endpoints — resumen

| FormType        | Método | Path                                   | Descripción                                  |
| --------------- | ------ | -------------------------------------- | -------------------------------------------- |
| CLINICAL        | POST   | `/api/v1/submissions/clinical`             | Análisis clínico humano (con foto pedido)    |
| UROCULTURE      | POST   | `/api/v1/submissions/uroculture`           | Subform de Clínica Humana                    |
| VAGINAL_EXUDATE | POST   | `/api/v1/submissions/vaginal-exudate`      | Subform de Clínica Humana                    |
| VETERINARY      | POST   | `/api/v1/submissions/veterinary`           | Análisis veterinario                         |
| AGRO_FOOD       | POST   | `/api/v1/submissions/agro-food`            | Análisis agro y alimentos                    |
| ENVIRONMENTAL   | POST   | `/api/v1/submissions/environmental`        | Análisis ambiental                           |
| GENETIC         | POST   | `/api/v1/submissions/genetic`              | Estudio genético                             |

Todos retornan `201 Created` con el `FormSubmission` creado en `data`.

---

## 1. Clínica Humana — `POST /api/v1/submissions/clinical`

**Flujo del front:**
1. Usuario carga la foto del pedido médico en el formulario.
2. Front pide firma a `POST /api/v1/uploads/medical-order/sign` (ver sección Cloudinary).
3. Front sube la foto **directo a Cloudinary** con la firma. Cloudinary devuelve `secure_url`.
4. Front envía este formulario con `medicalOrderUrl = secure_url`.

### Request body

```json
{
  "name": "María López",
  "dni": "30123456",
  "email": "maria@example.com",
  "birthDate": "1990-05-12",
  "phone": "+5493434567890",
  "healthInsurance": "OSDE",
  "requestingDoctor": "Dr. Pérez (MP 12345)",
  "observations": "Análisis pre-quirúrgico",
  "consentGiven": true,
  "medicalOrderUrl": "https://res.cloudinary.com/<cloud>/image/upload/v1/cbi-viale/medical-orders/abc123.jpg"
}
```

### Campos

| Campo              | Tipo          | Obligatorio | Validación                                        |
| ------------------ | ------------- | ----------- | ------------------------------------------------- |
| name               | string        | Sí          | 2–120 chars                                       |
| dni                | string        | Sí          | 7-9 dígitos                                       |
| email              | string        | Sí          | email válido                                      |
| birthDate          | string (ISO)  | Sí          | fecha válida (`YYYY-MM-DD` o ISO 8601)            |
| phone              | string        | Sí          | 8-15 dígitos, "+" opcional                        |
| healthInsurance    | string        | No          | máx 120 chars                                     |
| requestingDoctor   | string        | No          | máx 200 chars                                     |
| observations       | string        | No          | máx 2000 chars                                    |
| consentGiven       | boolean       | Sí          | debe ser `true`                                   |
| medicalOrderUrl    | string (URL)  | Sí          | URL completa a Cloudinary                         |

---

## 2. Urocultivo — `POST /api/v1/submissions/uroculture`

Subformulario de Clínica Humana. El front lo envía cuando el pedido médico incluye urocultivo.

**Modos de uso:**
- **Linkeado al CLINICAL padre:** mandar `parentSubmissionId` (id devuelto al crear el CLINICAL). En este caso, `email` y `phone` son opcionales (se heredan).
- **Standalone:** sin `parentSubmissionId`, `email` y `phone` son obligatorios.

### Request body

```json
{
  "parentSubmissionId": "ckxxx...",
  "name": "María López",
  "dni": "30123456",
  "email": "maria@example.com",
  "phone": "+5493434567890",
  "age": 34,
  "collectionTime": "08:30",
  "collectionDate": "2026-05-15",
  "sampleType": "Chorro medio",
  "symptoms": "Ardor al orinar y dolor lumbar",
  "pregnancy": false,
  "previousAntibiotics": "Amoxicilina desde el 10/05/2026",
  "baselinePathology": "Diabetes tipo 2",
  "consentGiven": true
}
```

### Campos

| Campo                 | Tipo          | Obligatorio                     | Validación                                                    |
| --------------------- | ------------- | ------------------------------- | ------------------------------------------------------------- |
| parentSubmissionId    | string        | No                              | id de un FormSubmission CLINICAL                              |
| name                  | string        | Sí                              | 2–120 chars                                                   |
| dni                   | string        | Sí                              | 7-9 dígitos                                                   |
| email                 | string        | Sí (si sin parent)              | email válido                                                  |
| phone                 | string        | Sí (si sin parent)              | 8-15 dígitos, "+" opcional                                    |
| age                   | number (int)  | Sí                              | 0–150                                                         |
| collectionTime        | string        | Sí                              | HH:MM (24h)                                                   |
| collectionDate        | string (ISO)  | Sí                              | fecha válida                                                  |
| sampleType            | enum          | No                              | `Sonda` \| `Punción Suprapúbica` \| `Chorro medio`            |
| symptoms              | string        | Sí                              | máx 2000 chars                                                |
| pregnancy             | boolean       | No                              | true/false                                                    |
| previousAntibiotics   | string        | Sí                              | máx 500 chars (escribir "Ninguno" si no aplica)               |
| baselinePathology     | string        | Sí                              | máx 500 chars (escribir "Ninguna" si no aplica)               |
| consentGiven          | boolean       | Sí                              | debe ser `true`                                               |

---

## 3. Exudado Vaginal — `POST /api/v1/submissions/vaginal-exudate`

Subformulario de Clínica Humana. Misma lógica de `parentSubmissionId` que urocultivo, pero acá **`name`, `email` y `phone`** son los que se heredan si hay parent.

### Request body

```json
{
  "parentSubmissionId": "ckxxx...",
  "name": "María López",
  "dni": "30123456",
  "email": "maria@example.com",
  "phone": "+5493434567890",
  "age": 28,
  "lastMenstruationDate": "2026-05-01",
  "symptoms": "Picazón y secreción anormal",
  "pregnancies": 1,
  "flowCharacteristics": "Blanco grumoso, sin olor",
  "contraceptiveUse": "Pastillas anticonceptivas hace 2 años",
  "vaginalInfectionHistory": "Candidiasis hace 6 meses",
  "abortionCount": 0,
  "consentGiven": true
}
```

### Campos

| Campo                    | Tipo          | Obligatorio                     | Validación                                          |
| ------------------------ | ------------- | ------------------------------- | --------------------------------------------------- |
| parentSubmissionId       | string        | No                              | id de un FormSubmission CLINICAL                    |
| name                     | string        | Sí (si sin parent)              | 2–120 chars                                         |
| dni                      | string        | No                              | 7-9 dígitos (heredado del parent si está)           |
| email                    | string        | Sí (si sin parent)              | email válido                                        |
| phone                    | string        | Sí (si sin parent)              | 8-15 dígitos                                        |
| age                      | number (int)  | Sí                              | 0–150                                               |
| lastMenstruationDate     | string (ISO)  | Sí                              | fecha válida                                        |
| symptoms                 | string        | Sí                              | máx 2000 chars                                      |
| pregnancies              | number (int)  | Sí                              | 0–30 (cantidad de embarazos previos)                |
| flowCharacteristics      | string        | Sí                              | máx 1000 chars                                      |
| contraceptiveUse         | string        | Sí                              | máx 500 chars ("Ninguno" si no usa)                 |
| vaginalInfectionHistory  | string        | Sí                              | máx 1000 chars ("Ninguno" si no tiene)              |
| abortionCount            | number (int)  | Sí                              | 0–30                                                |
| consentGiven             | boolean       | Sí                              | debe ser `true`                                     |

---

## 4. Veterinaria — `POST /api/v1/submissions/veterinary`

### Request body

```json
{
  "ownerName": "Juan García",
  "dniOrCuit": "30123456",
  "phone": "+5493434567890",
  "email": "juan@example.com",
  "animalName": "Firulais",
  "species": "Canino",
  "breed": "Labrador",
  "animalAge": 5,
  "requestingVet": "Dr. Veterinario Pérez (MV 12345)",
  "sampleType": "Sangre",
  "collectionDate": "2026-05-15",
  "observations": "Animal con síntomas hace 3 días"
}
```

### Campos

| Campo            | Tipo          | Obligatorio | Validación                                                          |
| ---------------- | ------------- | ----------- | ------------------------------------------------------------------- |
| ownerName        | string        | Sí          | 2–120 chars                                                         |
| dniOrCuit        | string        | Sí          | DNI (7-9 dígitos) o CUIT (11 dígitos, con o sin guiones)            |
| phone            | string        | Sí          | 8-15 dígitos                                                        |
| email            | string        | Sí          | email válido                                                        |
| animalName       | string        | Sí          | 1–80 chars                                                          |
| species          | enum          | Sí          | ver lista abajo                                                     |
| breed            | string        | Sí          | máx 100 chars                                                       |
| animalAge        | number (int)  | Sí          | 0–100 (años)                                                        |
| requestingVet    | string        | Sí          | máx 200 chars                                                       |
| sampleType       | enum          | Sí          | ver lista abajo                                                     |
| collectionDate   | string (ISO)  | Sí          | fecha válida                                                        |
| observations     | string        | No          | máx 2000 chars                                                      |

### Enums Veterinaria

**species**: `Canino` | `Felino` | `Equino` | `Bovino` | `Porcino` | `Ovino` | `Caprino` | `Aves` | `Otros`

**sampleType**: `Sangre` | `Suero` | `Orina` | `Materia fecal` | `Hisopado` | `Tejido` | `Líquido sinovial` | `Otros`

---

## 5. Agro y Alimentos — `POST /api/v1/submissions/agro-food`

### Request body

```json
{
  "companyName": "Distribuidora Norte SA",
  "cuit": "30-71234567-8",
  "phone": "+5493434567890",
  "email": "contacto@distribuidora.com",
  "productType": "Harina de trigo 000",
  "batch": "L-2026-0512",
  "productionDate": "2026-04-20",
  "analysisType": "Microbiológico",
  "sampleQuantity": "500g",
  "collectionDate": "2026-05-15",
  "origin": "Planta Rosario",
  "observations": "Lote para exportación"
}
```

### Campos

| Campo            | Tipo          | Obligatorio | Validación                                                  |
| ---------------- | ------------- | ----------- | ----------------------------------------------------------- |
| companyName      | string        | Sí          | 2–200 chars (nombre o razón social)                         |
| cuit             | string        | Sí          | 11 dígitos, con o sin guiones                               |
| phone            | string        | Sí          | 8-15 dígitos                                                |
| email            | string        | Sí          | email válido                                                |
| productType      | string        | Sí          | máx 200 chars                                               |
| batch            | string        | No          | máx 80 chars                                                |
| productionDate   | string (ISO)  | No          | fecha válida                                                |
| analysisType     | enum          | Sí          | ver lista abajo                                             |
| sampleQuantity   | string        | Sí          | máx 80 chars (texto libre con unidad, ej "500g", "1L")      |
| collectionDate   | string (ISO)  | Sí          | fecha válida                                                |
| origin           | string        | No          | máx 200 chars                                               |
| observations     | string        | No          | máx 2000 chars                                              |

### Enum Agro y Alimentos

**analysisType**: `Microbiológico` | `Fisicoquímico` | `Composición nutricional` | `Detección de contaminantes` | `Pesticidas / agroquímicos` | `Micotoxinas` | `Otros`

---

## 6. Ambiental — `POST /api/v1/submissions/environmental`

### Request body

```json
{
  "companyName": "Cooperativa Agua Pura",
  "cuit": "30-71234567-8",
  "phone": "+5493434567890",
  "email": "contacto@cooperativa.com",
  "sampleType": "Agua de pozo",
  "samplingPoint": "Pozo norte planta industrial",
  "location": "Ruta 12 km 45, Paraná",
  "collectionDate": "2026-05-15",
  "collectionTime": "14:30",
  "analysisType": "Bacteriológico",
  "samplingResponsible": "Ing. Mario Pérez",
  "observations": "Muestra para auditoría sanitaria"
}
```

### Campos

| Campo                | Tipo          | Obligatorio | Validación                                |
| -------------------- | ------------- | ----------- | ----------------------------------------- |
| companyName          | string        | Sí          | 2–200 chars                               |
| cuit                 | string        | Sí          | 11 dígitos                                |
| phone                | string        | Sí          | 8-15 dígitos                              |
| email                | string        | Sí          | email válido                              |
| sampleType           | enum          | Sí          | ver lista abajo                           |
| samplingPoint        | string        | Sí          | máx 200 chars                             |
| location             | string        | Sí          | máx 300 chars                             |
| collectionDate       | string (ISO)  | Sí          | fecha válida                              |
| collectionTime       | string        | No          | HH:MM                                     |
| analysisType         | enum          | Sí          | ver lista abajo                           |
| samplingResponsible  | string        | No          | máx 200 chars                             |
| observations         | string        | No          | máx 2000 chars                            |

### Enums Ambiental

**sampleType**: `Agua potable` | `Agua de pozo` | `Agua de red` | `Efluente cloacal` | `Efluente industrial` | `Aire` | `Suelo` | `Otros`

**analysisType**: `Bacteriológico` | `Fisicoquímico` | `Metales pesados` | `Detección de coliformes` | `Otros`

---

## 7. Genética — `POST /api/v1/submissions/genetic`

### Request body

```json
{
  "name": "María López",
  "dni": "30123456",
  "phone": "+5493434567890",
  "email": "maria@example.com",
  "studyType": "Filiación / paternidad",
  "studyReason": "Confirmación de paternidad",
  "sampleRelationship": "Padre e hijo",
  "sampleCount": 2,
  "collectionDate": "2026-05-15",
  "requestingProfessional": "Dr. Genetista Ramírez (MP 4567)",
  "observations": "Caso judicial en curso",
  "consentGiven": true,
  "ethnicity": "Caucásica",
  "diseaseStatus": "Sin enfermedad activa",
  "boneMarrowTransplant": false,
  "studyDetail": "Panel de 50 marcadores STR autosomales",
  "previousGeneticStudies": "Cariotipo en 2020 — normal"
}
```

### Campos

| Campo                    | Tipo          | Obligatorio | Validación                                  |
| ------------------------ | ------------- | ----------- | ------------------------------------------- |
| name                     | string        | Sí          | 2–120 chars                                 |
| dni                      | string        | Sí          | 7-9 dígitos                                 |
| phone                    | string        | Sí          | 8-15 dígitos                                |
| email                    | string        | Sí          | email válido                                |
| studyType                | enum          | Sí          | ver lista abajo                             |
| studyReason              | string        | Sí          | máx 1000 chars                              |
| sampleRelationship       | string        | No          | máx 500 chars                               |
| sampleCount              | number (int)  | Sí          | 1–50                                        |
| collectionDate           | string (ISO)  | Sí          | fecha válida                                |
| requestingProfessional   | string        | No          | máx 200 chars                               |
| observations             | string        | No          | máx 2000 chars                              |
| consentGiven             | boolean       | Sí          | debe ser `true`                             |
| ethnicity                | string        | Sí          | máx 80 chars (raza / etnia)                 |
| diseaseStatus            | string        | No          | máx 500 chars                               |
| boneMarrowTransplant     | boolean       | No          | true/false                                  |
| studyDetail              | string        | Sí          | máx 1000 chars                              |
| previousGeneticStudies   | string        | No          | máx 1000 chars                              |

### Enum Genética

**studyType**: `Filiación / paternidad` | `Identificación forense` | `Estudio molecular / mutaciones` | `Cariotipo` | `Estudio oncológico` | `Otros`

---

## Cloudinary — Subir foto del pedido médico

Solo aplica al formulario de **Clínica Humana** (campo `medicalOrderUrl`).

### Paso 1 · Pedir firma al backend

```
POST /api/v1/uploads/medical-order/sign
```

**Sin body.** Response:

```json
{
  "data": {
    "cloudName": "estudio",
    "apiKey": "1234567890",
    "timestamp": 1733400000,
    "folder": "cbi-viale/medical-orders",
    "uploadPreset": "cbi_viale",
    "signature": "abc123def456...",
    "uploadUrl": "https://api.cloudinary.com/v1_1/estudio/image/upload"
  }
}
```

### Paso 2 · Validar archivo en el front (antes de subir)

Antes de hacer el upload, el front debe verificar:
- `file.size <= 10 * 1024 * 1024` (10 MB máximo).
- Extensión: `.jpg`, `.jpeg`, `.png`, `.pdf`, `.webp`, `.heic`, `.heif`.

Si no cumple, mostrar error al usuario sin disparar el upload (Cloudinary va a rechazar igual, pero ahorrás tráfico y latencia).

### Paso 3 · Subir directo a Cloudinary

`POST` multipart/form-data al `uploadUrl`:

| Campo          | Valor                                                |
| -------------- | ---------------------------------------------------- |
| file           | el archivo (input file del usuario)                  |
| api_key        | `data.apiKey` del paso 1                             |
| timestamp      | `data.timestamp` del paso 1                          |
| folder         | `data.folder` del paso 1                             |
| upload_preset  | `data.uploadPreset` del paso 1                       |
| signature      | `data.signature` del paso 1                          |

⚠️ El `upload_preset` es obligatorio — Cloudinary aplica formatos permitidos y demás restricciones server-side a través de él.

**Ejemplo (fetch):**

```ts
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf', 'webp', 'heic', 'heif']

async function uploadMedicalOrder(file: File): Promise<string> {
  // Validación cliente
  if (file.size > MAX_BYTES) throw new Error('El archivo supera 10 MB')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.includes(ext)) throw new Error('Formato no permitido')

  // 1. Pedir firma
  const signRes = await fetch('/api/v1/uploads/medical-order/sign', { method: 'POST' })
  const { data } = await signRes.json()

  // 2. Subir directo a Cloudinary
  const fd = new FormData()
  fd.append('file', file)
  fd.append('api_key', data.apiKey)
  fd.append('timestamp', String(data.timestamp))
  fd.append('folder', data.folder)
  fd.append('upload_preset', data.uploadPreset)
  fd.append('signature', data.signature)

  const res = await fetch(data.uploadUrl, { method: 'POST', body: fd })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Error subiendo a Cloudinary')

  // 3. Devolver la URL para mandar en el form CLINICAL
  return json.secure_url as string
}
```

La firma vence después de **1 hora** (rule de Cloudinary). Generala justo antes del upload.

---

## Códigos de respuesta

| Código | Cuándo                                                                           |
| ------ | -------------------------------------------------------------------------------- |
| 201    | Formulario creado correctamente                                                  |
| 200    | Firma de upload generada                                                         |
| 400    | Validación falló (DNI/CUIT/email/teléfono inválido, `consentGiven: false`, etc.) |
| 404    | `parentSubmissionId` no existe (subforms)                                        |
| 429    | Rate limit excedido (esperar 60 s)                                               |

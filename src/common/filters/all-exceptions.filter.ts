import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { Prisma } from '@prisma/client'

interface ErrorBody {
  statusCode: number
  message: string | string[]
  error: string
  path: string
  timestamp: string
}

/** Reason phrases HTTP estándar usadas cuando la excepción no provee `error`. */
const HTTP_REASON_PHRASES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

function reasonPhrase(status: number): string {
  return HTTP_REASON_PHRASES[status] ?? 'Error'
}

/**
 * Códigos Prisma de conectividad/transitorios: la query NO llegó a ejecutarse
 * (no se pudo abrir o se cayó la conexión). El servidor pudo estar dormido
 * (cold start de Neon) o caído. Se mapean a 503 con mensaje genérico — nunca se
 * devuelve el host ni la connection string al cliente.
 */
const PRISMA_CONNECTIVITY_CODES = new Set<string>([
  'P1001', // Can't reach database server
  'P1002', // Database server reached but timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
])

const SERVICE_UNAVAILABLE_MESSAGE =
  'Servicio temporalmente no disponible. Reintentá en unos segundos.'

/**
 * Filter global — respuestas de error UNIFORMES en toda la API.
 * Maneja: HttpException de Nest, errores de Prisma conocidos, y resto como 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const { statusCode, message, error } = this.extractErrorInfo(exception)

    const body: ErrorBody = {
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    }

    // Log de errores 5xx como error, 4xx como warn.
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : exception,
      )
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${statusCode} · ${JSON.stringify(message)}`,
      )
    }

    // 503 → sugerimos al cliente cuándo reintentar (cold start de Neon, etc.).
    if (statusCode === HttpStatus.SERVICE_UNAVAILABLE) {
      response.header('Retry-After', '3')
    }

    response.status(statusCode).send(body)
  }

  private extractErrorInfo(exception: unknown): {
    statusCode: number
    message: string | string[]
    error: string
  } {
    // Nest HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const response = exception.getResponse()
      if (typeof response === 'string') {
        return { statusCode: status, message: response, error: reasonPhrase(status) }
      }
      const responseObj = response as { message?: string | string[]; error?: string }
      return {
        statusCode: status,
        message: responseObj.message ?? exception.message,
        // Antes caía a `exception.name` (ej "UnauthorizedException") cuando el
        // response no traía `error` — devolvemos la reason phrase HTTP estándar.
        error: responseObj.error ?? reasonPhrase(status),
      }
    }

    // Prisma: fallo de inicialización/conexión (cold start de Neon, DB caída,
    // credenciales inválidas al abrir el cliente). Genérico → no filtra infra.
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: SERVICE_UNAVAILABLE_MESSAGE,
        error: 'Service Unavailable',
      }
    }

    // Prisma: unique constraint (P2002), not found (P2025), etc.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Conectividad transitoria → 503 (la query no se ejecutó; reintentable).
      if (PRISMA_CONNECTIVITY_CODES.has(exception.code)) {
        return {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: SERVICE_UNAVAILABLE_MESSAGE,
          error: 'Service Unavailable',
        }
      }
      if (exception.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un registro con ese valor único',
          error: 'Conflict',
        }
      }
      if (exception.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro no encontrado',
          error: 'Not Found',
        }
      }
      // Resto: NO devolvemos `exception.message` — puede filtrar tabla/columna/
      // valor de la query. Se loguea completo server-side (ver `catch`); al
      // cliente, genérico con el código Prisma como pista segura.
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `No se pudo procesar la solicitud (${exception.code})`,
        error: 'Bad Request',
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validación de datos falló en la DB',
        error: 'Bad Request',
      }
    }

    // Prisma: panic del engine / error desconocido → 500 genérico, sin filtrar.
    if (
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      }
    }

    // Fallback 500. En prod NO exponemos el mensaje crudo (puede filtrar internals
    // de libs de terceros); el stack se loguea igual en `catch`. En dev sí, para
    // debuggear cómodo.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Error interno del servidor'
          : exception instanceof Error
            ? exception.message
            : 'Internal server error',
      error: 'Internal Server Error',
    }
  }
}

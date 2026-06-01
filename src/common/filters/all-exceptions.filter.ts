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

    // Prisma: unique constraint (P2002), not found (P2025), etc.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
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
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.message.split('\n').pop() ?? 'Database error',
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

    // Fallback 500
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception instanceof Error ? exception.message : 'Internal server error',
      error: 'Internal Server Error',
    }
  }
}

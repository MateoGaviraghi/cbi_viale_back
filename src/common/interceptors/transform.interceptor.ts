import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { map, type Observable } from 'rxjs'

export interface Response<T> {
  data: T
  meta?: Record<string, unknown>
}

/**
 * Envuelve toda respuesta exitosa en { data, meta? }. Uniformiza el shape del
 * API para que el front siempre espere el mismo formato.
 * Si el controller retorna ya { data, meta }, lo respeta tal cual.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Response<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'data' in (payload as object)
        ) {
          return payload as unknown as Response<T>
        }
        return { data: payload }
      }),
    )
  }
}

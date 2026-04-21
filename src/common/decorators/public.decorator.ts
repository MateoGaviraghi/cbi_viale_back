import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/**
 * @Public() — marca un endpoint como accesible sin JWT.
 * Útil para login, signup, endpoints de catálogo público, etc.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'
import type { Env } from '../config/env.schema'

export interface MedicalOrderSignResult {
  cloudName: string
  apiKey: string
  timestamp: number
  folder: string
  uploadPreset: string
  signature: string
  /** URL completa a la que el front hace POST con el archivo. */
  uploadUrl: string
}

/**
 * Genera firmas para uploads directos del front a Cloudinary.
 *
 * Por qué firmado y no unsigned:
 *  - Sin firma habría que crear un upload_preset público en Cloudinary, lo que
 *    permite subidas anónimas con solo conocer el cloud_name (riesgo bajo pero real).
 *  - Con firma, el server controla qué params se aceptan y bajo qué condiciones.
 *
 * Firma = SHA-1(<params alfabéticamente ordenados>=<values>&<api_secret>).
 * Ref: https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 */
@Injectable()
export class UploadsService {
  private readonly cloudName: string
  private readonly apiKey: string
  private readonly apiSecret: string
  private readonly folder: string
  private readonly uploadPreset: string

  constructor(config: ConfigService<Env, true>) {
    this.cloudName = config.get('CLOUDINARY_CLOUD_NAME', { infer: true })
    this.apiKey = config.get('CLOUDINARY_API_KEY', { infer: true })
    this.apiSecret = config.get('CLOUDINARY_API_SECRET', { infer: true })
    this.folder = config.get('CLOUDINARY_UPLOAD_FOLDER', { infer: true })
    this.uploadPreset = config.get('CLOUDINARY_UPLOAD_PRESET', { infer: true })
  }

  /** Firma para subir foto de pedido médico al folder configurado. */
  signMedicalOrderUpload(): MedicalOrderSignResult {
    this.assertConfigured()

    const timestamp = Math.floor(Date.now() / 1000)
    // Todo param que se manda al upload de Cloudinary y que querés que sea
    // forzado por la firma debe ir acá. Si lo omitimos, el front podría
    // tamperearlo y bypasear las restricciones del preset.
    const paramsToSign: Record<string, string | number> = {
      folder: this.folder,
      timestamp,
      upload_preset: this.uploadPreset,
    }

    const signature = this.signParams(paramsToSign)

    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      folder: this.folder,
      uploadPreset: this.uploadPreset,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
    }
  }

  /**
   * Verifica que una URL provenga del cloud propio. Útil para validar el campo
   * `medicalOrderUrl` que llega del front: previene que mande URLs arbitrarias.
   */
  isOwnCloudinaryUrl(url: string): boolean {
    if (!this.cloudName) return false
    return url.startsWith(`https://res.cloudinary.com/${this.cloudName}/`)
  }

  isConfigured(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret)
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Servicio de uploads no configurado (faltan credenciales de Cloudinary).',
      )
    }
  }

  private signParams(params: Record<string, string | number>): string {
    const ordered = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&')
    return createHash('sha1').update(`${ordered}${this.apiSecret}`).digest('hex')
  }
}

import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { Public } from '../common/decorators/public.decorator'
import { UploadsService, type MedicalOrderSignResult } from './uploads.service'

@ApiTags('uploads')
@Controller({ path: 'uploads', version: '1' })
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * Devuelve credenciales firmadas para que el front suba la foto del pedido
   * médico directo a Cloudinary. El front usa `signature + timestamp + apiKey
   * + folder` con un POST multipart al `uploadUrl`. Cloudinary responde con
   * `secure_url` que el front manda en el form CLINICAL como `medicalOrderUrl`.
   *
   * Throttling estricto (5/min) porque es público y firma operaciones contra
   * un servicio de pago.
   */
  @Public()
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  @Post('medical-order/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Genera firma Cloudinary para subir la foto del pedido médico (Clínica Humana).',
  })
  signMedicalOrder(): MedicalOrderSignResult {
    return this.uploads.signMedicalOrderUpload()
  }

  /**
   * Idem que medical-order/sign pero apunta al folder de firmas. El front
   * captura la firma con un canvas (signature_pad), exporta a PNG y la sube
   * directo a Cloudinary con el payload firmado. La URL devuelta se manda
   * como `signatureUrl` en el body del POST a /appointments o /submissions/*.
   */
  @Public()
  @Throttle({ strict: { limit: 5, ttl: 60_000 } })
  @Post('signature/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Genera firma Cloudinary para subir el PNG de firma del consentimiento.',
  })
  signSignature(): MedicalOrderSignResult {
    return this.uploads.signSignatureUpload()
  }
}

/**
 * Procesa una firma desde un SVG (que envuelve un JPEG embebido) o un JPEG/PNG
 * directo, y la convierte a PNG con fondo transparente y bordes recortados.
 *
 * Output ideal para subir a Cloudinary y embeber en el PDF de consentimiento.
 *
 * Uso:
 *   npx ts-node -T scripts/process-signature.ts <input> [output] [--rotate=<deg>]
 *
 * Ejemplos:
 *   npx ts-node -T scripts/process-signature.ts "C:\Users\mateo\Downloads\firma-nahir.svg"
 *   npx ts-node -T scripts/process-signature.ts firma.svg out.png --rotate=-90
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

/** Umbral de luminancia: pixeles más claros que esto se vuelven transparentes. */
const LUMINANCE_THRESHOLD = 215
/** Margen de transición para suavizar bordes (anti-aliasing). */
const SOFT_EDGE_RANGE = 30

async function main() {
  const args = process.argv.slice(2)
  const rotateArg = args.find((a) => a.startsWith('--rotate='))
  const positional = args.filter((a) => !a.startsWith('--'))
  const input = positional[0]
  const output = positional[1] ?? 'scripts/fixtures/firma-nahir.png'
  const rotateDeg = rotateArg ? parseInt(rotateArg.split('=')[1] ?? '0', 10) : 0
  if (!input) {
    console.error('[error] Falta input. Uso: npx ts-node scripts/process-signature.ts <input.svg|jpg> [output.png] [--rotate=<deg>]')
    process.exit(1)
  }

  const inputAbs = resolve(input)
  const outputAbs = resolve(output)
  mkdirSync(dirname(outputAbs), { recursive: true })

  // 1) Si es SVG, extraer el JPEG/PNG embebido en base64.
  //    Si es JPEG/PNG, leer directo.
  let rasterBuffer: Buffer
  if (inputAbs.toLowerCase().endsWith('.svg')) {
    const svgText = readFileSync(inputAbs, 'utf8')
    const match = svgText.match(/xlink:href="data:image\/(jpeg|png);base64,([^"]+)"/)
    if (!match || !match[1] || !match[2]) {
      console.error('[error] El SVG no contiene una imagen JPEG/PNG embebida en base64.')
      process.exit(1)
      return
    }
    rasterBuffer = Buffer.from(match[2], 'base64')
    console.log(`[ok] Extraído ${match[1].toUpperCase()} embebido (${(rasterBuffer.length / 1024).toFixed(0)} KB)`)
  } else {
    rasterBuffer = readFileSync(inputAbs)
    console.log(`[ok] Leído ${inputAbs} (${(rasterBuffer.length / 1024).toFixed(0)} KB)`)
  }

  // 2) Pipeline sharp: rotación opcional → trim → RGBA raw.
  let pipe = sharp(rasterBuffer)
  if (rotateDeg !== 0) {
    pipe = pipe.rotate(rotateDeg, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    console.log(`[ok] Rotado ${rotateDeg}°`)
  }
  const trimmed = await pipe
    .trim({ threshold: 30 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = trimmed
  console.log(`[ok] Recortado a ${info.width}x${info.height}`)

  // 3) Procesar pixel por pixel: blanco→transparente, oscuro→negro opaco.
  //    Transición suave para evitar bordes pixelados.
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    let alpha: number
    if (lum >= LUMINANCE_THRESHOLD) {
      alpha = 0 // fondo blanco → transparente
    } else if (lum >= LUMINANCE_THRESHOLD - SOFT_EDGE_RANGE) {
      // banda de transición lineal
      const t = (LUMINANCE_THRESHOLD - lum) / SOFT_EDGE_RANGE
      alpha = Math.round(t * 255)
    } else {
      alpha = 255
    }

    // Forzamos color de la firma a negro puro (más nítido) y conservamos alpha.
    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = alpha
  }

  // 4) Re-encode como PNG con compresión.
  const png = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer()

  writeFileSync(outputAbs, png)
  console.log(`[ok] PNG transparente generado: ${outputAbs} (${(png.length / 1024).toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error('[error]', err)
  process.exit(1)
})

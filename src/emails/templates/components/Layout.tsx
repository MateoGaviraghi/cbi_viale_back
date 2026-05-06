import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import { brand, brandItalic, colors, container, divider, footerLine, link, main, tagline } from '../styles'

interface LayoutProps {
  children: ReactNode
  preview: string
}

/**
 * Nota: probamos embeber el logo CBI como base64 (`data:image/png;...`),
 * pero Gmail y Outlook bloquean imágenes en `data:` URI por seguridad — solo
 * renderizan URLs HTTP(S) absolutas. Si más adelante se quiere recuperar el
 * logo visual, hay que hostearlo en un CDN público (ej. Cloudinary, donde el
 * back ya tiene credenciales) y referenciarlo con su URL pública.
 *
 * Por ahora el header usa texto serif + tagline (siempre rinde 100% en todos
 * los clientes).
 */

/**
 * Layout editorial CBI Viale — espejo visual del sitio web.
 *
 * Header: logo CBI dorado centrado + tagline italic.
 * Body: tipografía sans web-safe.
 * Footer: dirección, teléfono, horarios + nota legal corta.
 *
 * `preview` es el texto que ve el usuario en el listado del inbox.
 */
export function Layout({ children, preview }: LayoutProps) {
  return (
    <Html lang="es">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ textAlign: 'center', marginBottom: '4px' }}>
            <Heading as="h1" style={{ ...brand, textAlign: 'center' }}>
              CBI <span style={brandItalic}>Viale</span>
            </Heading>
            <Text style={{ ...tagline, textAlign: 'center' }}>
              Donde la ciencia y el cuidado se encuentran
            </Text>
          </Section>

          <Hr style={divider} />

          {children}

          <Hr style={divider} />

          <Section>
            <Text style={{ ...footerLine, color: colors.textMuted, marginBottom: '4px' }}>
              CBI Viale · Centro Bioquímico Integral
            </Text>
            <Text style={footerLine}>Manuel Belgrano 594 · Viale, Entre Ríos</Text>
            <Text style={footerLine}>
              <Link href="tel:+543433020527" style={{ ...link, color: colors.textFooter }}>
                Tel 343 302-0527
              </Link>
              {' · '}
              <Link
                href="https://wa.me/543433020527"
                style={{ ...link, color: colors.textFooter }}
              >
                WhatsApp
              </Link>
            </Text>
            <Text style={{ ...footerLine, marginTop: '12px' }}>
              Lun–Vie 07:00–12:00 y 14:00–18:00 · Sáb 08:00–12:00
            </Text>
            <Text style={{ ...footerLine, fontSize: '11px', color: colors.textFooter, marginTop: '16px', fontStyle: 'italic' }}>
              Recibís este correo porque iniciaste un trámite con nuestro centro. Si no reconocés
              esta solicitud, ignorá este mensaje.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

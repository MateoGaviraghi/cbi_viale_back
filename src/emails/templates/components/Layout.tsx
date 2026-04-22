import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import { brand, container, divider, footerLine, main, tagline } from '../styles'

interface LayoutProps {
  children: ReactNode
  preview: string
}

/**
 * Layout común de todos los emails CBI — header con branding + separador +
 * children + footer con datos del centro.
 * `preview` es el texto que ve el usuario en el listado del inbox (hidden
 * en el body, visible en la línea de preview).
 */
export function Layout({ children, preview }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading as="h1" style={brand}>
            CBI Viale
          </Heading>
          <Text style={tagline}>Donde la ciencia y el cuidado se encuentran</Text>
          <Hr style={divider} />
          {children}
          <Hr style={divider} />
          <Text style={footerLine}>
            Manuel Belgrano 594 · Viale, Entre Ríos · Tel 3433020527
          </Text>
          <Text style={footerLine}>
            Lun-Vie 07:00–12:00 y 14:00–18:00 · Sáb 08:00–12:00
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

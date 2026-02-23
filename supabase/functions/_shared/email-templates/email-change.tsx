/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a alteração do seu email no FlipClass</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoBar}>
          <div style={logoIconBox}>📚</div>
          <span style={logoText}>FlipClass</span>
        </div>
        <Heading style={h1}>Confirmar alteração de email</Heading>
        <Text style={text}>
          Você solicitou a alteração do seu email no FlipClass de{' '}
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>{' '}
          para{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>Clique no botão abaixo para confirmar:</Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar Alteração
        </Button>
        <Text style={footer}>
          Se você não solicitou esta alteração, proteja sua conta imediatamente.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoBar = { marginBottom: '24px' }
const logoIconBox = { fontSize: '24px', display: 'inline' as const, marginRight: '8px' }
const logoText = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0d8b7c', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a2332', margin: '0 0 20px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#0d8b7c', textDecoration: 'underline' }
const button = { backgroundColor: '#0d8b7c', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '12px', padding: '12px 24px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0' }

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface InstitutionalInviteProps { confirmationUrl?: string }

const InstitutionalInviteEmail = ({ confirmationUrl }: InstitutionalInviteProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado para o FlipClass</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>📚 FlipClass</Text>
        <Heading style={heading}>Você foi convidado! 🎉</Heading>
        <Text style={text}>Você recebeu um convite para se juntar ao <strong>FlipClass</strong>. Clique no botão abaixo para definir sua senha e acessar a plataforma.</Text>
        <Button style={button} href={confirmationUrl || 'https://flip.posologia.app/reset-password'}>Definir Minha Senha</Button>
        <Text style={footer}>Se você não esperava este convite, pode ignorar este email com segurança.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InstitutionalInviteEmail,
  subject: 'Convite para o FlipClass — Defina sua Senha',
  displayName: 'Convite institucional',
  previewData: { confirmationUrl: 'https://flip.posologia.app/reset-password' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '520px', margin: '40px auto', padding: '32px', border: '1px solid #e5e7eb', borderRadius: '8px' }
const brand = { textAlign: 'center' as const, fontSize: '24px', fontWeight: '700' as const, color: '#0d8b7c', margin: '0 0 24px' }
const heading = { fontSize: '18px', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 28px' }
const button = { display: 'block', backgroundColor: '#0d8b7c', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '600' as const }
const footer = { borderTop: '1px solid #e5e7eb', color: '#9ca3af', fontSize: '12px', margin: '24px 0 0', paddingTop: '20px', textAlign: 'center' as const }
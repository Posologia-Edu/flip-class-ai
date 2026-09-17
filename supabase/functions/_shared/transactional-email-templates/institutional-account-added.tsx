import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface InstitutionalAccountAddedProps { loginUrl?: string }

const InstitutionalAccountAddedEmail = ({ loginUrl }: InstitutionalAccountAddedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi adicionado a uma instituição no FlipClass</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>FlipClass</Text>
        <Heading style={heading}>Você foi adicionado a uma instituição!</Heading>
        <Text style={text}>Sua conta na plataforma <strong>FlipClass</strong> foi vinculada ao plano Institucional. Você já pode acessar todos os recursos disponíveis.</Text>
        <Button style={button} href={loginUrl || 'https://flip.posologia.app/auth'}>Acessar FlipClass</Button>
        <Text style={footer}>FlipClass — Plataforma de Sala de Aula Invertida</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InstitutionalAccountAddedEmail,
  subject: 'Você foi adicionado ao FlipClass!',
  displayName: 'Conta adicionada a uma instituição',
  previewData: { loginUrl: 'https://flip.posologia.app/auth' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '520px', margin: '40px auto', padding: '32px', border: '1px solid #e5e7eb', borderRadius: '8px' }
const brand = { textAlign: 'center' as const, fontSize: '24px', fontWeight: '700' as const, color: '#0d8b7c', margin: '0 0 24px' }
const heading = { fontSize: '18px', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 28px' }
const button = { display: 'block', backgroundColor: '#0d8b7c', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '600' as const }
const footer = { borderTop: '1px solid #e5e7eb', color: '#9ca3af', fontSize: '12px', margin: '24px 0 0', paddingTop: '20px', textAlign: 'center' as const }
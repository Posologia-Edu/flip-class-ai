import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface ContactMessageProps {
  senderName?: string
  senderEmail?: string
  subject?: string
  message?: string
}

const ContactMessageEmail = ({ senderName, senderEmail, subject, message }: ContactMessageProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Nova mensagem de contato no FlipClass</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>FlipClass</Text>
        <Heading style={heading}>Nova mensagem de contato</Heading>
        <Section style={details}>
          <Text style={line}><strong>De:</strong> {senderName || 'Visitante'} ({senderEmail || 'Email não informado'})</Text>
          <Text style={line}><strong>Assunto:</strong> {subject || 'Sem assunto'}</Text>
        </Section>
        <Text style={messageStyle}>{message || 'Mensagem não informada'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactMessageEmail,
  subject: (data: Record<string, any>) => `[FlipClass Contato] ${data.subject || 'Nova mensagem'}`,
  to: 'sergio.araujo@ufrn.br',
  displayName: 'Mensagem de contato',
  previewData: {
    senderName: 'Maria Silva',
    senderEmail: 'maria@example.com',
    subject: 'Dúvida sobre uma turma',
    message: 'Olá! Gostaria de tirar uma dúvida sobre o acesso à plataforma.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 28px' }
const brand = { color: '#0d8b7c', fontSize: '20px', fontWeight: '700' as const, margin: '0 0 24px' }
const heading = { color: '#1a2332', fontSize: '22px', margin: '0 0 20px' }
const details = { backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }
const line = { color: '#334155', fontSize: '14px', lineHeight: '1.6', margin: '4px 0' }
const messageStyle = { color: '#334155', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap' as const }
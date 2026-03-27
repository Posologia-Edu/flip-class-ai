import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "FlipClass"

interface FeedbackQuestion {
  question: string
  studentAnswer: string
  grade: number | null
  maxPoints: number
  feedbackText: string
}

interface FeedbackCompletedProps {
  studentName?: string
  roomTitle?: string
  totalEarned?: number
  totalPossible?: number
  questions?: FeedbackQuestion[]
}

const FeedbackCompletedEmail = ({
  studentName,
  roomTitle,
  totalEarned,
  totalPossible,
  questions,
}: FeedbackCompletedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Feedback da atividade "{roomTitle || 'Atividade'}" disponível</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoText}>{SITE_NAME}</Text>
        </Section>

        <Heading style={h1}>
          {studentName ? `Olá, ${studentName}!` : 'Olá!'}
        </Heading>
        <Text style={text}>
          O professor concluiu a correção da sua atividade na sala <strong>{roomTitle || 'Atividade'}</strong>.
          Confira abaixo o feedback detalhado de cada questão.
        </Text>

        {totalPossible != null && totalEarned != null && (
          <Section style={scoreCard}>
            <Text style={scoreTitle}>Pontuação Final</Text>
            <Text style={scoreValue}>{totalEarned} / {totalPossible} pts</Text>
            <Text style={scorePercent}>
              {totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0}% de aproveitamento
            </Text>
          </Section>
        )}

        <Hr style={divider} />

        {questions && questions.length > 0 ? (
          questions.map((q, i) => (
            <Section key={i} style={questionSection}>
              <Text style={questionTitle}>{i + 1}. {q.question}</Text>
              <Section style={answerBox}>
                <Text style={answerLabel}>Sua resposta:</Text>
                <Text style={answerText}>{q.studentAnswer || 'Não respondida'}</Text>
              </Section>
              <Section style={gradeRow}>
                <Text style={gradeText}>
                  Nota: <strong>{q.grade != null ? q.grade : '—'} / {q.maxPoints}</strong>
                </Text>
              </Section>
              {q.feedbackText && (
                <Section style={feedbackBox}>
                  <Text style={feedbackLabel}>Feedback do professor:</Text>
                  <Text style={feedbackText}>{q.feedbackText}</Text>
                </Section>
              )}
            </Section>
          ))
        ) : (
          <Text style={text}>Acesse a plataforma para ver o feedback detalhado.</Text>
        )}

        <Hr style={divider} />

        <Text style={footer}>
          Este é um e-mail automático enviado por {SITE_NAME}. Acesse a plataforma para mais detalhes.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FeedbackCompletedEmail,
  subject: (data: Record<string, any>) =>
    `Feedback disponível: ${data.roomTitle || 'Atividade'}`,
  displayName: 'Feedback de atividade concluído',
  previewData: {
    studentName: 'Maria Silva',
    roomTitle: 'Farmacologia Clínica',
    totalEarned: 7,
    totalPossible: 10,
    questions: [
      {
        question: 'Qual a principal função do farmacêutico clínico?',
        studentAnswer: 'Garantir o uso racional de medicamentos.',
        grade: 4,
        maxPoints: 5,
        feedbackText: 'Boa resposta! Poderia incluir o acompanhamento farmacoterapêutico.',
      },
      {
        question: 'Descreva o método SOAP.',
        studentAnswer: 'Subjetivo, Objetivo, Avaliação e Plano.',
        grade: 3,
        maxPoints: 5,
        feedbackText: 'Correto, mas faltou exemplificar cada etapa.',
      },
    ],
  },
} satisfies TemplateEntry

// Styles
const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
const headerSection = {
  backgroundColor: 'hsl(174, 62%, 38%)',
  padding: '24px 25px',
  borderRadius: '12px 12px 0 0',
}
const logoText = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700' as const,
  margin: '0',
  letterSpacing: '-0.5px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: '600' as const,
  color: '#1a1a2e',
  margin: '24px 25px 8px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.6',
  margin: '0 25px 20px',
}
const scoreCard = {
  backgroundColor: 'hsl(174, 62%, 95%)',
  border: '1px solid hsl(174, 62%, 80%)',
  borderRadius: '10px',
  padding: '16px 20px',
  margin: '0 25px 20px',
  textAlign: 'center' as const,
}
const scoreTitle = {
  fontSize: '12px',
  fontWeight: '600' as const,
  color: 'hsl(174, 62%, 30%)',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}
const scoreValue = {
  fontSize: '28px',
  fontWeight: '700' as const,
  color: 'hsl(174, 62%, 30%)',
  margin: '0 0 2px',
}
const scorePercent = {
  fontSize: '13px',
  color: 'hsl(174, 62%, 38%)',
  margin: '0',
}
const divider = { borderColor: '#e5e7eb', margin: '8px 25px' }
const questionSection = {
  margin: '16px 25px',
  padding: '16px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
}
const questionTitle = {
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#1a1a2e',
  margin: '0 0 10px',
}
const answerBox = {
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  padding: '10px 12px',
  margin: '0 0 10px',
  border: '1px solid #e5e7eb',
}
const answerLabel = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#888',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
}
const answerText = { fontSize: '13px', color: '#333', margin: '0', lineHeight: '1.5' }
const gradeRow = { margin: '0 0 8px' }
const gradeText = { fontSize: '13px', color: 'hsl(174, 62%, 30%)', margin: '0' }
const feedbackBox = {
  backgroundColor: 'hsl(174, 62%, 97%)',
  borderRadius: '6px',
  padding: '10px 12px',
  borderLeft: '3px solid hsl(174, 62%, 38%)',
}
const feedbackLabel = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: 'hsl(174, 62%, 30%)',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
}
const feedbackText = { fontSize: '13px', color: '#333', margin: '0', lineHeight: '1.5' }
const footer = {
  fontSize: '12px',
  color: '#999999',
  margin: '20px 25px',
  textAlign: 'center' as const,
}

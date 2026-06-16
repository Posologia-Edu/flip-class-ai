# Plano: 3 Features Disruptivas

Vou implementar em sequência, cada uma como módulo independente. Todas usam o AI Fallback existente (Gemini→Groq→OpenAI→OpenRouter→Anthropic) e respeitam RLS + admin bypass.

---

## 1. Gêmeo Digital do Aluno (Digital Twin Pedagógico)

**O que faz:** Modelo vivo por aluno que prevê risco de reprovação (2 semanas), decaimento de memória por conceito (Ebbinghaus) e estilo cognitivo dominante. Recomenda micro-intervenções.

### Backend
- **Tabela `student_twins`**: snapshot por (room_id, student_email) com:
  - `risk_score` (0-100), `risk_factors` (jsonb), `predicted_at`
  - `cognitive_style` ('visual'|'reader'|'practical'|'mixed')
  - `style_confidence` (0-1)
  - `memory_decay` (jsonb: `[{topic, last_seen, strength, next_review_at}]`)
  - `recommendations` (jsonb: `[{type, topic, action, when, duration_min}]`)
  - `updated_at`
- **Edge function `student-twin-update`**: recebe `room_id` + `student_email` (ou batch da sala), agrega:
  - quizzes (`student_sessions.answers`, scores, tempo)
  - logs de materiais (`student_activity_logs`: tipo, duração)
  - simulações (`simulation_sessions.summary`)
  - padrões de erro (quais tópicos erra mais)
  - Calcula risco com heurística + IA (gera `risk_factors` e `recommendations` via LLM)
  - Estilo cognitivo: razão tempo-em-PDFs vs vídeos vs simulações
  - Decay: para cada tópico estudado, aplica curva R = e^(-t/S), S aumenta com revisões
- **Edge function `student-twin-batch`**: roda para todos os alunos de uma sala (botão "Atualizar Twins").

### Frontend
- **Componente `StudentTwinPanel.tsx`** (professor): grid de cards por aluno com risco (cor verde/âmbar/vermelho), estilo cognitivo (badge), top 3 recomendações, tópicos com baixa retenção.
- **Aba "Gêmeos Digitais"** em `RoomManage.tsx` (Analytics).
- **Componente `MyTwinView.tsx`** (aluno): seu próprio twin — sem o risco cru, mostra "Sua próxima revisão", "Você aprende melhor por…", agenda de micro-revisões.

---

## 2. Debate Socrático com IA (Voz)

**O que faz:** Sala 1:1 por voz onde IA examinadora faz perguntas progressivas, contesta respostas, exige evidências do material. Gera rubrica de raciocínio clínico.

### Tecnologia
- **OpenAI Realtime API** via WebRTC (precisa de `OPENAI_API_KEY` — já temos no AI Fallback). Se ausente, exibe aviso para professor configurar.
- Token efêmero gerado por edge function (`socratic-realtime-token`) — chave nunca vai ao client.
- RAG: edge function `socratic-context` pré-empacota até 40k chars dos materiais da sala (mesmo padrão do AI Quiz).

### Backend
- **Tabela `socratic_sessions`**:
  - `room_id`, `student_email`, `topic`, `started_at`, `ended_at`, `duration_sec`
  - `transcript` (jsonb: turnos)
  - `rubric` (jsonb: `clinical_reasoning`, `evidence_use`, `clarity`, `depth` — 0-10 cada)
  - `final_grade` (numeric), `feedback_md` (text)
- **Edge function `socratic-realtime-token`**: gera token efêmero Realtime + injeta system prompt com instruções socráticas + contexto RAG.
- **Edge function `socratic-end`**: recebe transcript completo, IA gera rubrica + nota + feedback markdown.

### Frontend
- **Componente `SocraticDebateRoom.tsx`** (aluno): botão "Iniciar debate" → conecta WebRTC, mostra waveform, transcript ao vivo, timer (mín 5min, máx 20min). Botão "Encerrar" → mostra rubrica.
- **Trigger no aluno**: card na lista de atividades da sala "Debate Socrático sobre [tópico]".
- **Listagem no professor**: aba mostrando sessões com nota e transcript.

---

## 3. OSCE Virtual Automatizado

**O que faz:** N estações cronometradas (anamnese, prescrição, comunicação, cálculo de dose). IA avalia cada uma com rubrica e emite certificado.

### Backend
- **Tabela `osce_exams`** (criada pelo professor):
  - `room_id`, `title`, `description`, `stations` (jsonb: `[{id, type, prompt, duration_sec, rubric_criteria, max_score}]`)
  - `passing_score`, `created_by`, `unlock_at`
- **Tabela `osce_attempts`**:
  - `exam_id`, `student_email`, `started_at`, `completed_at`
  - `station_responses` (jsonb: `[{station_id, response, time_used_sec, ai_score, ai_feedback}]`)
  - `total_score`, `passed`, `certificate_id`
- **Edge function `osce-generate`**: IA gera estações a partir de tópico (5 tipos: anamnese, prescrição, comunicação, cálculo, raciocínio). Reusa AI Fallback.
- **Edge function `osce-evaluate-station`**: recebe resposta + rubrica → IA retorna score + feedback.
- **Edge function `osce-certificate`**: gera PDF simples (HTML→PDF inline) com nome, exame, nota, hash.

### Frontend
- **Componente `OSCEBuilder.tsx`** (professor): cria exame, gera estações via IA, edita rubricas.
- **Componente `OSCEPlayer.tsx`** (aluno): tela cheia, uma estação por vez com timer regressivo, auto-submit ao zerar, transição forçada (sem voltar).
- **Componente `OSCEResults.tsx`**: mostra score por estação, rubrica detalhada, certificado para download.
- **Aba "OSCE"** em `RoomManage.tsx`.

---

## Ordem de Execução

1. Digital Twin (migration + 2 edge fns + 2 componentes) — base de dados existente, mais rápido
2. OSCE (migration + 3 edge fns + 3 componentes) — independente, alto valor
3. Debate Socrático (migration + 2 edge fns + 2 componentes) — depende de OPENAI_API_KEY ativa

Vou implementar tudo em sequência sem interrupção. Estimativa: ~15-20 arquivos novos, ~5 edits.

---

**Confirma a ordem? Posso começar pelo Digital Twin?** Ou prefere outra prioridade (ex.: só Debate Socrático primeiro)?
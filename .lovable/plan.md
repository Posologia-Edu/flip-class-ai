

# Feedback Qualitativo do Professor nas Respostas dos Alunos

## Objetivo
Permitir que o professor escreva feedback textual e atribua uma nota (0-10) para cada resposta individual dos alunos, diretamente na aba "Respostas" do painel de gerenciamento da sala.

## O que muda para o professor
- Na aba "Respostas", ao expandir as respostas de um aluno, cada resposta terá um campo de texto para feedback e um seletor de nota (0-10).
- Um botao "Salvar Feedback" persiste os dados.
- Feedbacks ja salvos aparecem preenchidos ao reabrir.

## O que muda para o aluno
- Apos concluir a atividade, na tela de conclusao, o aluno podera ver os feedbacks do professor (quando disponíveis) ao clicar em "Ver Feedback".

---

## Detalhes Tecnicos

### 1. Nova tabela: `teacher_feedback`

```sql
CREATE TABLE public.teacher_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.student_sessions(id) ON DELETE CASCADE,
  question_key text NOT NULL,  -- formato "nivel-questao" ex: "0-1"
  feedback_text text,
  grade smallint CHECK (grade >= 0 AND grade <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, question_key)
);

ALTER TABLE public.teacher_feedback ENABLE ROW LEVEL SECURITY;
```

**Politicas RLS:**
- SELECT: qualquer pessoa pode ler (alunos precisam ver seu feedback)
- INSERT/UPDATE/DELETE: apenas o professor dono da sala (via join com student_sessions -> rooms -> teacher_id)

### 2. Alteracoes no Frontend - RoomManage.tsx (Aba Respostas)

- Adicionar estado para armazenar feedbacks carregados do banco
- Buscar feedbacks existentes no `fetchData`
- Em cada bloco de resposta do aluno, adicionar:
  - `Textarea` para feedback qualitativo
  - `Select` com notas de 0 a 10
  - Botao "Salvar" que faz upsert na tabela `teacher_feedback`
- Indicador visual quando feedback ja foi salvo (icone de check)

### 3. Alteracoes no Frontend - StudentView.tsx

- Apos submissao (`submitted === true`), adicionar botao "Ver Feedback do Professor"
- Buscar feedbacks da tabela `teacher_feedback` para a sessao do aluno
- Exibir cada feedback ao lado da pergunta correspondente, com a nota atribuida
- Se nao houver feedback ainda, exibir mensagem "Aguardando avaliacao do professor"

### 4. Sequencia de implementacao

1. Criar a migration da tabela `teacher_feedback` com RLS
2. Atualizar `RoomManage.tsx` - carregar, exibir e salvar feedbacks na aba Respostas
3. Atualizar `StudentView.tsx` - exibir feedbacks recebidos apos conclusao
4. Testar o fluxo completo


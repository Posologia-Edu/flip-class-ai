

## Plano: Atividades Interativas + Assistente de Estudo IA

### Visão Geral

Duas funcionalidades principais: (1) novos tipos de atividades interativas (arrastar e soltar, preencher lacunas, correspondência, ordenação) e (2) um chatbot de estudo por IA integrado à visão do aluno.

---

### Funcionalidade 1: Atividades Interativas

**Situação atual**: O sistema suporta apenas `multiple_choice`, `case_study` e `open_ended`. As questões são armazenadas em `quiz_data` (JSONB) na tabela `activities`. A renderização acontece em `StudentView.tsx` (linhas 842-872) com um `if/else` simples entre múltipla escolha e textarea.

**Novos tipos de questão**:
- `drag_and_drop` — arrastar itens para categorias corretas
- `fill_in_the_blank` — preencher lacunas em um texto
- `matching` — conectar pares (termo ↔ definição)
- `ordering` — ordenar itens na sequência correta

**Mudanças necessárias**:

1. **Componentes de renderização interativa** (`src/components/interactive-questions/`)
   - `DragAndDropQuestion.tsx` — grid de itens arrastáveis + zonas de drop por categoria. Usa `@dnd-kit/core` para drag-and-drop acessível.
   - `FillInTheBlankQuestion.tsx` — renderiza texto com `___` substituído por inputs inline.
   - `MatchingQuestion.tsx` — duas colunas com linhas de conexão ou drag entre colunas.
   - `OrderingQuestion.tsx` — lista reordenável com drag-and-drop vertical.
   - `QuestionRenderer.tsx` — componente dispatcher que seleciona o renderer correto pelo `type`.

2. **Atualizar `StudentView.tsx`** — substituir o bloco `if/else` (linhas 842-872) pelo `QuestionRenderer`, que despacha para o componente correto.

3. **Atualizar `generate-quiz/index.ts`** — adicionar um novo prompt `INTERACTIVE_PROMPT` que instrui a IA a gerar questões nos novos formatos. O professor escolheria o tipo "Atividade Interativa" ao gerar.

4. **Atualizar `RoomManage.tsx`** — adicionar "interactive" como novo `ActivityGenerationType` e UI para criação manual dos novos tipos.

5. **Estrutura JSON das novas questões**:

```text
drag_and_drop:
  { type: "drag_and_drop", question: "...", items: ["A","B","C"], 
    categories: ["Cat1","Cat2"], correct_mapping: {"A":"Cat1","B":"Cat2","C":"Cat1"} }

fill_in_the_blank:
  { type: "fill_in_the_blank", question: "O ___ é a capital do ___",
    blanks: ["Brasil", "país"], correct_answers: ["Brasília", "Brasil"] }

matching:
  { type: "matching", question: "...", 
    pairs: [{"left":"DNA","right":"Ácido desoxirribonucleico"}, ...] }

ordering:
  { type: "ordering", question: "Ordene os eventos...",
    items: ["Evento A","Evento B","Evento C"], correct_order: [2,0,1] }
```

6. **Dependência**: instalar `@dnd-kit/core` e `@dnd-kit/sortable` para drag-and-drop.

7. **Correção automática**: As respostas dos novos tipos são verificáveis programaticamente (comparação de mapeamento, ordem, texto). Adicionar lógica de auto-correção no submit do aluno, sem necessidade de IA.

---

### Funcionalidade 2: Assistente de Estudo IA

**Conceito**: Chatbot acessível na aba "Materiais" ou como nova aba "Assistente" no `StudentView`. Usa o conteúdo dos materiais da sala como contexto para responder perguntas, gerar resumos e sugerir exercícios.

**Mudanças necessárias**:

1. **Edge Function `supabase/functions/study-assistant/index.ts`**
   - Recebe: `room_id`, `session_id`, `message`, `conversation_history`
   - Busca materiais da sala (`content_text_for_ai`) + dados de desempenho do aluno
   - Constrói system prompt com contexto dos materiais e performance
   - Chama `callAiWithFallback` (provedores externos primeiro, Lovable AI como fallback)
   - Retorna resposta em streaming (SSE)

2. **Componente `src/components/StudyAssistant.tsx`**
   - Interface de chat com histórico de mensagens
   - Botões de ação rápida: "Resuma o material", "Explique X", "Gere exercícios"
   - Renderização de markdown nas respostas
   - Indicador de digitação durante streaming

3. **Atualizar `StudentView.tsx`**
   - Adicionar nova aba "Assistente IA" com ícone de Bot
   - Renderizar `StudyAssistant` passando `roomId`, `sessionId`

4. **Controle de uso**
   - Usar `ai_usage_log` para limitar interações por plano (ex: Free: 10/mês, Professor: 50/mês, Institucional: ilimitado)
   - Registrar cada interação na tabela existente

5. **System prompt dinâmico**:
   - Inclui conteúdo dos materiais da sala (truncado a 30k chars)
   - Inclui resumo do desempenho do aluno (notas, questões erradas)
   - Instruções para responder em português, ser pedagógico, e referenciar o material

---

### Detalhes Técnicos

**Arquivos a criar**:
- `src/components/interactive-questions/DragAndDropQuestion.tsx`
- `src/components/interactive-questions/FillInTheBlankQuestion.tsx`
- `src/components/interactive-questions/MatchingQuestion.tsx`
- `src/components/interactive-questions/OrderingQuestion.tsx`
- `src/components/interactive-questions/QuestionRenderer.tsx`
- `src/components/StudyAssistant.tsx`
- `supabase/functions/study-assistant/index.ts`

**Arquivos a modificar**:
- `src/pages/StudentView.tsx` — nova aba + QuestionRenderer
- `src/pages/RoomManage.tsx` — tipo "interactive" na geração + criação manual
- `supabase/functions/generate-quiz/index.ts` — novo prompt INTERACTIVE_PROMPT
- `package.json` — adicionar `@dnd-kit/core`, `@dnd-kit/sortable`, `react-markdown`

**Nenhuma migração de banco necessária** — os novos tipos usam o campo `quiz_data` JSONB existente.

---

### Ordem de implementação sugerida

1. Componentes de questões interativas + QuestionRenderer
2. Integração no StudentView
3. Prompt de geração interativa + UI no RoomManage
4. Edge Function do assistente de estudo
5. Componente StudyAssistant + integração no StudentView


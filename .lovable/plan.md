

## Plano: Atividades em Grupo — Acesso e Pontuação Coletiva

### Visão Geral

Quando o professor cria grupos de alunos numa sala, qualquer aluno dessa sala poderá optar por entrar no modo "grupo". O primeiro aluno do grupo a entrar será o líder e realizará a atividade. Ao submeter, a nota obtida pelo grupo será automaticamente replicada para todos os membros do grupo.

### Fluxo do Aluno

```text
[PIN] → [Dados + Toggle Grupo/Individual] → [Se grupo: sessão compartilhada] → [Atividade] → [Nota replicada]
```

1. **Tela do PIN (sem alteração)** — aluno digita o PIN normalmente.

2. **Tela de Dados (alterada)** — após validar o PIN, o sistema verifica se a sala possui grupos (`room_groups`). Se sim, aparece um toggle "Individual / Grupo" abaixo dos campos de nome e email.
   - **Individual**: fluxo normal, cria sessão individual.
   - **Grupo**: o aluno preenche nome e email, clica "Começar". O sistema verifica em qual grupo esse aluno está (via `room_group_members` → `room_students` pelo email). Se encontrado, o aluno entra como **líder do grupo**.

3. **Sessão de Grupo** — ao entrar em modo grupo:
   - O backend cria (ou reutiliza) uma sessão para cada membro do grupo automaticamente.
   - A sessão do líder é marcada como a sessão "principal" do grupo (nova coluna `group_session_id` em `student_sessions` apontando para si mesma, ou campo `is_group_leader`).
   - Os demais membros recebem sessões vinculadas ao mesmo grupo.

4. **Realização da Atividade** — apenas o líder responde. A StudentView mostra um banner "Atividade em Grupo — Grupo X" com os nomes dos membros.

5. **Submissão e Nota** — ao submeter a atividade, a nota é copiada para as sessões de todos os membros do grupo.

### Mudanças Técnicas

#### 1. Migração de Banco de Dados

- Adicionar colunas em `student_sessions`:
  - `group_id UUID REFERENCES room_groups(id)` — indica que a sessão pertence a um grupo
  - `is_group_leader BOOLEAN DEFAULT false` — marca o líder
- Política RLS: manter as existentes (não afeta segurança pois a lógica de replicação roda no backend).

#### 2. Tela de Entrada (`src/pages/Index.tsx`)

- Após buscar a sala pelo PIN, verificar se existem `room_groups` para esse `room_id`.
- Se existirem grupos, exibir um **Switch/Toggle** "Atividade em Grupo" na tela de dados.
- Quando ativado, ao submeter:
  - Enviar `mode: "group"` no payload para a edge function `student-session`.

#### 3. Edge Function `student-session/index.ts`

- Na action `create_session` com `mode: "group"`:
  1. Buscar o `room_students` pelo email do aluno.
  2. Buscar o grupo do aluno via `room_group_members`.
  3. Se não estiver em nenhum grupo, retornar erro.
  4. Criar sessão para o líder com `group_id` e `is_group_leader = true`.
  5. Para cada outro membro do grupo, criar (ou reutilizar) uma sessão com o mesmo `group_id` e `is_group_leader = false`.
  6. Retornar a sessão do líder + lista de membros do grupo.

- Na action `submit` (quando a sessão tem `group_id` e `is_group_leader`):
  1. Salvar score e answers na sessão do líder.
  2. Replicar o mesmo `score` e `answers` para todas as sessões com o mesmo `group_id`.

#### 4. StudentView (`src/pages/StudentView.tsx`)

- Ao carregar, se a sessão tiver `group_id`, exibir banner com nome do grupo e membros.
- Se `is_group_leader = false`, exibir mensagem "O líder do seu grupo está realizando a atividade" e desabilitar a aba de atividade (ou mostrar em modo somente leitura).
- Se `is_group_leader = true`, fluxo normal de atividade.

#### 5. Feedback do Professor

- No painel do professor (`RoomManage`), ao visualizar sessões de grupo, mostrar um badge indicando o grupo.
- A nota atribuída pelo professor (feedback manual) também será replicada para todos os membros do grupo via trigger ou lógica no frontend.

### Resumo das Alterações por Arquivo

| Arquivo | Alteração |
|---|---|
| Migração SQL | Adicionar `group_id` e `is_group_leader` em `student_sessions` |
| `src/pages/Index.tsx` | Toggle grupo/individual, verificação de grupos na sala |
| `supabase/functions/student-session/index.ts` | Lógica de criação de sessão em grupo e replicação de nota |
| `src/pages/StudentView.tsx` | Banner de grupo, bloqueio para não-líderes |
| `src/pages/RoomManage.tsx` | Badge de grupo nas sessões, replicação de feedback |


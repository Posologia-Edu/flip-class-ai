

## Plano: Projetos Colaborativos Orientados por IA

### Visão Geral

Adicionar uma funcionalidade onde o professor pode gerar projetos em grupo via IA, baseados nos materiais da sala. A IA sugere ideias de projeto, define papéis para os membros, recursos necessários e etapas. Os alunos podem ver seus projetos, atualizar progresso por etapa e colaborar. O professor monitora o andamento de todos os grupos.

---

### Mudanças no Banco de Dados

**Nova tabela `collaborative_projects`**:
- `id`, `room_id`, `title`, `description`, `roles` (JSONB — lista de papéis sugeridos), `resources` (JSONB — recursos recomendados), `milestones` (JSONB — etapas com título e descrição), `created_at`

**Nova tabela `project_groups`**:
- `id`, `project_id` (FK → collaborative_projects), `group_name`, `created_at`

**Nova tabela `project_members`**:
- `id`, `group_id` (FK → project_groups), `session_id` (FK → student_sessions), `assigned_role` (text), `created_at`

**Nova tabela `project_progress`**:
- `id`, `group_id` (FK → project_groups), `milestone_index` (integer), `status` (text: "pending", "in_progress", "done"), `notes` (text), `updated_at`, `created_at`

RLS: professores donos da sala gerenciam tudo; alunos podem ler seus projetos e atualizar progresso do próprio grupo. Realtime habilitado em `project_progress`.

---

### Edge Function: `generate-project`

- Recebe `room_id`; busca materiais da sala (`content_text_for_ai`)
- Usa `callAiWithFallback` para gerar 2-3 ideias de projeto com: título, descrição, 3-5 papéis, recursos sugeridos e 4-6 etapas (milestones)
- Retorna JSON estruturado; professor escolhe qual projeto salvar

---

### Lado do Professor (`RoomManage.tsx`)

- Nova seção/aba "Projetos Colaborativos" com botão "Gerar Projetos por IA"
- Exibe as ideias geradas em cards; professor seleciona e salva
- Após salvar, pode criar grupos manualmente (arrastando alunos) ou usar distribuição automática
- Painel de acompanhamento mostrando progresso de cada grupo por etapa (barra de progresso)

---

### Lado do Aluno (`StudentView.tsx`)

- Nova aba "Projeto" (ícone Users/Lightbulb)
- Exibe: título do projeto, descrição, papel atribuído ao aluno, membros do grupo
- Lista de etapas (milestones) com status visual (pendente → em andamento → concluído)
- Aluno pode atualizar status e adicionar notas em cada etapa do seu grupo

---

### Arquivos a Criar
- `supabase/functions/generate-project/index.ts`
- `src/components/CollaborativeProjects.tsx` (painel do professor)
- `src/components/StudentProject.tsx` (visão do aluno)

### Arquivos a Modificar
- `src/pages/RoomManage.tsx` — adicionar aba/seção de projetos
- `src/pages/StudentView.tsx` — adicionar aba "Projeto"
- `supabase/config.toml` — registrar nova function

### Migração SQL
- Criar 4 tabelas com RLS + habilitar realtime em `project_progress`

---

### Ordem de Implementação

1. Migração de banco (tabelas + RLS)
2. Edge Function `generate-project`
3. Componente do professor (`CollaborativeProjects`)
4. Integração no `RoomManage`
5. Componente do aluno (`StudentProject`)
6. Integração no `StudentView`


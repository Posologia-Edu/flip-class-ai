

# Implementacao das 3 Funcionalidades do Plano Institucional

## 1. Exportacao de Relatorios (PDF/CSV)

Adicionar botoes de exportacao na pagina de Analytics e no AnalyticsReport para que professores do plano Institucional possam baixar relatorios.

**Abordagem:**
- **CSV**: Gerar client-side usando JS puro (sem dependencia extra). Exportar dados de sessoes, notas, tempo por material e alunos em risco.
- **PDF**: Usar `window.print()` com CSS de impressao dedicado, ou gerar via uma abordagem simples de HTML-to-PDF no cliente. Para manter simplicidade, usaremos `window.print()` com um layout otimizado para impressao.
- Gate: Apenas planos `institutional` (ja definido como `advanced_analytics: true` + checagem adicional de plano).

**Arquivos modificados:**
- `src/components/AnalyticsReport.tsx` -- Adicionar botoes "Exportar CSV" e "Exportar PDF"
- `src/pages/AnalyticsPage.tsx` -- Adicionar botoes de exportacao no nivel geral (cross-room)
- `src/hooks/useFeatureGate.ts` -- Adicionar `canExportReports()` (retorna `effectivePlan === "institutional"`)

---

## 2. Painel Multi-professores

Permitir que instituicoes vejam e gerenciem as salas de todos os professores vinculados. Um usuario com plano Institucional tera acesso a uma pagina que agrega dados de todos os professores convidados pela mesma instituicao.

**Abordagem:**
- Criar nova pagina `src/pages/InstitutionalDashboard.tsx`
- Buscar todos os professores cujo email esta em `admin_invites` onde `invited_by = user.id` e `status = 'active'`
- Para cada professor, buscar suas salas e estatisticas
- Exibir em tabela com filtros por professor
- Adicionar rota `/dashboard/institutional` e link no sidebar (visivel apenas para plano institucional)

**Arquivos modificados/criados:**
- `src/pages/InstitutionalDashboard.tsx` (novo)
- `src/App.tsx` -- Adicionar rota
- `src/components/AppSidebar.tsx` -- Adicionar link condicional
- `src/hooks/useFeatureGate.ts` -- Adicionar `canUseMultiTeacher()`

**Banco de dados:**
- Nenhuma migracao necessaria. Usaremos `admin_invites` + `profiles` + `rooms` + `student_sessions` existentes.
- Sera necessario criar uma RLS policy ou usar edge function para permitir que o usuario institucional leia salas de outros professores. Usaremos uma **edge function** (`institutional-dashboard`) para buscar dados com `service_role`, evitando mudancas complexas em RLS.

---

## 3. White-label Basico

Permitir que instituicoes personalizem logo e cores da plataforma.

**Abordagem:**
- Criar tabela `institution_settings` com colunas: `id`, `user_id`, `logo_url`, `primary_color`, `institution_name`, `created_at`, `updated_at`
- Adicionar secao de configuracao na pagina `MyAccount` (ou na nova pagina institucional)
- Upload de logo no bucket `materials` (ja existente e publico)
- Aplicar cores e logo dinamicamente no sidebar e header

**Arquivos modificados/criados:**
- Migracao: criar tabela `institution_settings`
- `src/pages/InstitutionalDashboard.tsx` -- Adicionar aba de configuracoes white-label
- `src/components/AppSidebar.tsx` -- Carregar e exibir logo personalizado
- `src/hooks/useFeatureGate.ts` -- Adicionar `canUseWhiteLabel()`

---

## Detalhes Tecnicos

### Nova Edge Function: `institutional-dashboard`
```text
POST /institutional-dashboard
Body: { action: "get_teachers" | "get_teacher_rooms" }
- Autentica usuario
- Verifica se tem plano institucional
- Busca professores vinculados via admin_invites
- Retorna dados agregados
```

### Migracao SQL
```sql
CREATE TABLE public.institution_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#0d9488',
  institution_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON public.institution_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Feature Gate (novas funcoes)
```text
canExportReports() -> effectivePlan === "institutional"
canUseMultiTeacher() -> effectivePlan === "institutional"
canUseWhiteLabel() -> effectivePlan === "institutional"
```

### Sequencia de Implementacao
1. Migracao do banco (institution_settings)
2. useFeatureGate -- adicionar 3 novas funcoes
3. Exportacao PDF/CSV no AnalyticsReport e AnalyticsPage
4. Edge function institutional-dashboard
5. Pagina InstitutionalDashboard (multi-professores + white-label)
6. Sidebar e App.tsx -- rota e link condicional
7. Aplicar white-label dinamico no sidebar



# Auditoria e Implementacao Completa de Travas de Plano, Stripe e Convites

## Diagnostico: Problemas Encontrados

### 1. NENHUMA trava de plano esta implementada
A funcao `getPlanLimits()` existe em `src/lib/subscription.ts` mas **nunca e chamada** em nenhum lugar do sistema. Isso significa que:
- Usuarios do plano gratuito podem criar salas ilimitadas
- Podem fazer upload de arquivos sem restricao
- Podem acessar Analytics, Banco de Questoes, Calendario, Peer Review sem limitacao
- Geracoes e correcoes de IA nao sao contabilizadas
- Nao ha limite de alunos por sala

### 2. Stripe parcialmente configurado
- Checkout, check-subscription e customer-portal existem como Edge Functions
- Produtos e precos estao definidos no codigo (`prod_U1yOTsueyuc6SQ`, `prod_U1yOWsVEIi6joe`)
- Gerenciamento de assinatura so e possivel via portal externo do Stripe (abre em nova aba)
- **Precisa verificar**: se estes produtos realmente existem no Stripe conectado

### 3. Convites nao permitem escolher plano
- Admin convida com "Premium Vitalicio" fixo sem opcao de escolha
- Nao existe coluna `granted_plan` na tabela `admin_invites`
- `useSubscription` nao considera plano concedido por admin

### 4. Revogacao funciona parcialmente
- Revoga convites pendentes e deleta usuario do auth
- Nao revoga/downgrade usuarios ja ativos

---

## Plano de Implementacao

### Tarefa 1: Criar tabela de contagem de uso de IA
Adicionar uma tabela `ai_usage_log` para rastrear geracoes e correcoes de IA por professor por mes.

```text
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  usage_type TEXT NOT NULL, -- 'generation' ou 'correction'
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: users can view own, service role can insert
```

Adicionar coluna `granted_plan` na tabela `admin_invites`:
```text
ALTER TABLE public.admin_invites ADD COLUMN granted_plan TEXT DEFAULT 'institutional';
```

### Tarefa 2: Criar hook `useFeatureGate`
Novo hook centralizado que combina `useSubscription` com planos concedidos por admin.

**Arquivo:** `src/hooks/useFeatureGate.ts`

Funcionalidades:
- Verificar se o usuario tem um plano concedido via convite admin (consulta `admin_invites` pelo email do usuario)
- Usar o maior plano entre Stripe e admin-grant
- Expor funcoes: `canCreateRoom()`, `canUploadFile()`, `canUsePeerReview()`, `canUseQuestionBank()`, `canUseAdvancedAnalytics()`, `canGenerateQuiz()`, `canUseAiCorrection()`, `getRoomStudentLimit()`, `getRoomLimit()`

### Tarefa 3: Implementar travas em todas as paginas

**`src/pages/RoomsList.tsx`:**
- Antes de criar sala, verificar `rooms.length < limit.max_rooms` (ou ilimitado se -1)
- Mostrar mensagem e link para upgrade quando atingir limite

**`src/pages/RoomManage.tsx`:**
- Upload de arquivo: verificar `canUploadFile()`
- Geracao de quiz: verificar `canGenerateQuiz()` e contagem mensal
- Correcao AI: verificar `canUseAiCorrection()` e contagem mensal
- Peer Review: verificar `canUsePeerReview()`
- Esconder/desabilitar botoes bloqueados com tooltip "Disponivel no plano Professor"

**`src/pages/QuestionBank.tsx`:**
- Verificar `canUseQuestionBank()` no topo; se bloqueado, mostrar tela de upgrade

**`src/pages/AnalyticsPage.tsx`:**
- Verificar `canUseAdvancedAnalytics()`; se bloqueado, mostrar preview com blur e CTA de upgrade

**`src/pages/CalendarPage.tsx`:**
- Bloquear para plano gratuito (calendario e feature do plano Professor+)

**`src/components/PeerReview.tsx`:**
- Verificar antes de habilitar peer review em atividade

**Student session join (StudentView):**
- Verificar limite de alunos por sala antes de permitir entrada

### Tarefa 4: Contabilizar uso de IA nas Edge Functions

**`supabase/functions/generate-quiz/index.ts`:**
- Antes de gerar, consultar `ai_usage_log` do mes atual para o usuario
- Comparar com limite do plano
- Se excedido, retornar erro 403 com mensagem clara
- Apos sucesso, inserir registro em `ai_usage_log`

**`supabase/functions/ai-grade/index.ts`:**
- Mesma logica para correcoes

### Tarefa 5: Gerenciamento de assinatura in-app

**`src/pages/MyAccount.tsx`:**
- Adicionar secao "Gerenciar Assinatura" com botoes:
  - "Alterar Plano" - abre pagina de pricing
  - "Cancelar Assinatura" - abre dialog de confirmacao, chama `customer-portal`
- Mostrar data de renovacao/expiracao
- Se plano concedido por admin, mostrar badge "Concedido pelo Administrador"

**`src/pages/Pricing.tsx`:**
- Para usuario ja assinante de outro plano, mostrar "Alterar para este plano" ao inves de "Iniciar Teste Gratis"
- Botao "Gerenciar Assinatura" para plano atual (ja existe parcialmente)

### Tarefa 6: Admin pode escolher plano ao convidar

**`src/pages/AdminPanel.tsx`:**
- Adicionar Select de plano no formulario de convite (Gratuito, Professor, Institucional)
- Passar `granted_plan` na chamada da Edge Function

**`supabase/functions/admin-invite/index.ts`:**
- Receber `granted_plan` no body
- Salvar na coluna `granted_plan` da tabela `admin_invites`

**`src/hooks/useFeatureGate.ts` (ja criado na Tarefa 2):**
- Consultar `admin_invites` pelo email do usuario para verificar plano concedido

### Tarefa 7: Admin pode revogar acesso de convidados ativos

**`supabase/functions/admin-invite/index.ts`:**
- Na acao `revoke_invite`, tambem funcionar para usuarios ativos:
  - Remover registro de `admin_invites`
  - Mudar `approval_status` do profile para "rejected"
  - Efetivamente bloqueia o acesso do usuario

**`src/pages/AdminPanel.tsx`:**
- Mostrar opcao de revogar tanto para invites pendentes quanto ativos
- Para ativos, dialog de confirmacao diferente: "O usuario perdera acesso imediatamente"

---

## Detalhes Tecnicos

### Hook useFeatureGate (Tarefa 2)
```text
// src/hooks/useFeatureGate.ts
export function useFeatureGate() {
  const { user } = useAuth();
  const { planKey: stripePlan } = useSubscription(user?.id);
  const [grantedPlan, setGrantedPlan] = useState<PlanKey | null>(null);

  // Query admin_invites for granted_plan by user email
  useEffect(() => { /* fetch granted_plan */ }, [user?.email]);

  const effectivePlan = resolveHighestPlan(stripePlan, grantedPlan);
  const limits = getPlanLimits(effectivePlan);

  return {
    effectivePlan,
    limits,
    canCreateRoom: (currentCount) => limits.max_rooms === -1 || currentCount < limits.max_rooms,
    canUploadFile: () => limits.file_upload,
    // ... etc
  };
}
```

### Componente UpgradeGate (reutilizavel)
```text
// Componente que envolve features bloqueadas
<UpgradeGate feature="question_bank" planRequired="professor">
  <QuestionBankContent />
</UpgradeGate>
```
Quando bloqueado, mostra overlay com icone de cadeado e botao "Fazer Upgrade".

### Sequencia de implementacao
1. Migration (tabela + coluna) -- Tarefa 1
2. Hook useFeatureGate -- Tarefa 2
3. Componente UpgradeGate -- Tarefa 3
4. Travas nas paginas -- Tarefa 3
5. Contagem de IA nas Edge Functions -- Tarefa 4
6. Gerenciamento in-app -- Tarefa 5
7. Admin escolher plano + revogar -- Tarefas 6 e 7

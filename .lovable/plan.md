

## Plano: Sistema de Consentimento de Cookies para FlipClass

### Contexto Atual
- Ja existe uma pagina `/cookies` com a politica de cookies documentada
- O sidebar usa cookie `sidebar:state` para persistir estado
- Supabase usa localStorage para sessao de auth
- SessionStorage e usado para tokens de aluno
- Nao existe nenhum banner de consentimento ou sistema de coleta/rastreamento

### O que sera implementado

#### 1. Componente CookieConsentBanner
Um banner fixo na parte inferior da tela (estilo LGPD) que aparece na primeira visita. Tera 3 opcoes:
- **Aceitar todos** -- habilita todos os cookies
- **Apenas essenciais** -- so cookies necessarios para login/sessao
- **Personalizar** -- abre modal com switches por categoria

Categorias:
| Categoria | Exemplos | Obrigatorio? |
|-----------|----------|--------------|
| Essenciais | Auth session, token aluno, tema | Sim |
| Funcionalidade | Estado sidebar, preferencias de exibicao | Nao |
| Analitica | Rastreamento de navegacao, tempo em pagina, cliques | Nao |

O consentimento sera salvo em localStorage (`flipclass_cookie_consent`) com timestamp e categorias aceitas.

#### 2. Hook `useCookieConsent`
Centraliza a logica de consentimento:
- Verifica se consentimento ja foi dado
- Expoe `hasConsent(category)` para checar antes de coletar dados
- Expoe `updateConsent(preferences)` para alterar preferencias
- Re-exibe o banner se o consentimento tiver mais de 6 meses

#### 3. Coleta de Cookies Analiticos (quando consentido)
Criar um sistema leve de tracking que registra na tabela `student_activity_logs` (ja existente) e numa nova tabela `page_views`:

**Nova tabela `page_views`:**
- `id` (uuid, PK)
- `session_id` (text) -- ID anonimo gerado por visita
- `user_id` (uuid, nullable) -- se logado
- `path` (text) -- rota visitada
- `referrer` (text, nullable)
- `user_agent` (text, nullable)
- `created_at` (timestamptz)

Sera inserido via Supabase client a cada navegacao de rota, **apenas se** o usuario consentiu com cookies analiticos.

#### 4. Como usar os dados ao seu favor
Os dados coletados alimentarao:

- **Dashboard Admin (InstitutionalDashboard):** novas metricas de paginas mais visitadas, funil de conversao (landing -> pricing -> signup), tempo medio de sessao
- **hub-metrics:** incluir `page_views_30d` e `unique_visitors_30d` nas metricas
- **Relatorios de engajamento:** quais funcionalidades os professores mais acessam, quais salas tem maior retorno de alunos
- **Otimizacao de vendas:** identificar onde visitantes abandonam o funil (ex: veem pricing mas nao criam conta)

#### 5. Integracao no App
- `CookieConsentBanner` renderizado no `App.tsx` (fora das rotas, sempre visivel)
- Link "Gerenciar cookies" adicionado ao `PublicFooter`
- Pagina `/cookies` atualizada com botao para reabrir o painel de preferencias

### Arquivos a criar/editar
- **Criar:** `src/components/CookieConsentBanner.tsx`, `src/hooks/useCookieConsent.ts`, `src/hooks/usePageTracking.ts`
- **Editar:** `src/App.tsx` (adicionar banner + tracking hook), `src/components/PublicFooter.tsx` (link gerenciar cookies), `src/pages/CookiePolicy.tsx` (botao de preferencias)
- **Migracao:** criar tabela `page_views` com RLS (insert para todos, select para admins)


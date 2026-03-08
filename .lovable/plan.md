
Objetivo: corrigir definitivamente a entrega do convite para novos professores (ex.: `sergiofernandesaraujo@hotmail.com`) com um fluxo mais confiável e com melhor rastreabilidade.

1) Diagnóstico confirmado (com base no código e logs)
- O convite de novo usuário hoje passa por `inviteUserByEmail` no backend (`institutional-dashboard`) e depende do `auth-email-hook` para envio.
- Nos logs, o evento de convite é disparado com sucesso e o `auth-email-hook` registra “Email sent successfully” para `sergiofernandesaraujo@hotmail.com`.
- Mesmo assim, o destinatário não recebe o email (caixa de entrada). Isso indica problema de entregabilidade no caminho atual (aceito pelo backend, mas não chegando ao inbox), não erro de autorização/execução.
- Convites para usuário já existente usam outro caminho (Resend direto no `institutional-dashboard`) e estão chegando.

2) Estratégia de correção
- Manter a criação/reativação de convite no backend institucional, mas mudar o envio para novos convidados para um fluxo “link gerado + envio direto”, no mesmo padrão que já funciona para usuário existente.
- Em vez de depender apenas do `inviteUserByEmail` para mandar email, gerar o link de convite explicitamente e enviar com `sendEmailWithFallback` (já existente no arquivo), usando remetente validado.
- Resultado esperado: unificar o canal de envio institucional em um pipeline já comprovado no projeto, reduzindo falhas silenciosas.

3) Mudanças planejadas (implementação)
- Arquivo: `supabase/functions/institutional-dashboard/index.ts`
  - No branch de “novo usuário / usuário não confirmado”:
    - Substituir (ou tornar secundário) o envio via `inviteUserByEmail` por:
      - geração de link de convite (`auth.admin.generateLink` com redirect para `/reset-password`);
      - envio de email com `sendEmailWithFallback` usando HTML de convite com CTA claro.
    - Se envio falhar:
      - retornar erro explícito para UI (em vez de sucesso silencioso);
      - manter log detalhado do motivo.
    - Se envio funcionar:
      - manter `admin_invites` como `pending` (upsert idempotente, como já está);
      - manter criação/atualização de `profiles` com `approval_status: approved`.
  - Garantir compatibilidade com reenvio para convite pendente (sem bloquear por early-return).
- Arquivo: `src/pages/InstitutionalDashboard.tsx`
  - Melhorar feedback de toast:
    - sucesso de envio,
    - aviso quando enviado por remetente alternativo,
    - erro real quando não houve despacho.
  - (Opcional no mesmo ciclo) adicionar ação explícita de “Reenviar convite” para linhas pendentes.

4) Observabilidade e depuração (para evitar regressão)
- Adicionar logs estruturados no `institutional-dashboard` para cada tentativa:
  - email destino,
  - tipo de fluxo (novo/existente),
  - resultado do envio,
  - remetente usado (`primary` vs `fallback`).
- Manter logs do `auth-email-hook` para auth padrão, mas o convite institucional passa a ter evidência completa no próprio fluxo institucional.

5) Validação ponta a ponta (critério de aceite)
- Teste principal:
  - convidar `sergiofernandesaraujo@hotmail.com`;
  - confirmar status `pending` no painel;
  - confirmar recebimento do email (Inbox + Spam).
- Teste de reenvio:
  - reenviar para mesmo email pendente e validar nova chegada.
- Teste de regressão:
  - convite para usuário já existente continua funcionando.
- Teste de link:
  - CTA abre `/reset-password` e permite definir senha corretamente.

6) Riscos e mitigação
- Risco: provedores como Hotmail podem atrasar/quarentenar.
  - Mitigação: envio com canal já funcional no projeto + logs explícitos + reenvio manual.
- Risco: múltiplos convites para o mesmo email.
  - Mitigação: manter `upsert` por email e lógica idempotente já existente.

7) Resultado esperado após aprovação
- Convite para novos professores deixa de depender exclusivamente do caminho que está “aceito no backend, mas não entregue”.
- Admin passa a ter retorno mais confiável no painel (sucesso real vs falha real).
- Redução imediata de falhas silenciosas em convites institucionais.



# Implementar Trial de 14 Dias no Checkout

## Problema
A pagina de precos promete "14 dias de teste gratis", mas o checkout do Stripe cobra imediatamente porque o parametro de trial nao foi configurado.

## Solucao

### 1. Atualizar a Edge Function `create-checkout`
Adicionar `subscription_data.trial_period_days: 14` na criacao da sessao do Stripe:

```text
stripe.checkout.sessions.create({
  ...
  subscription_data: {
    trial_period_days: 14,
  },
})
```

Isso faz com que o Stripe ative a assinatura mas so cobre apos 14 dias. O cartao e coletado no checkout, porem sem cobranca imediata.

### 2. Atualizar textos na pagina de Pricing
- Alterar o botao de "Assinar Agora" para "Iniciar Teste Gratis" nos planos pagos
- Adicionar uma nota abaixo do preco: "14 dias gratis, cancele quando quiser"

### 3. Atualizar `check-subscription` (opcional mas recomendado)
Verificar se o hook `useSubscription` ja reconhece corretamente assinaturas em trial (status `trialing` no Stripe). Assinaturas em trial tem `status: "trialing"` e devem ser tratadas como ativas.

## Detalhes tecnicos

Arquivo a editar:
- `supabase/functions/create-checkout/index.ts` -- adicionar `subscription_data.trial_period_days`
- `src/pages/Pricing.tsx` -- atualizar textos dos botoes
- `supabase/functions/check-subscription/index.ts` -- garantir que `trialing` seja tratado como assinatura ativa

Alteracao principal (1 linha na Edge Function):
```text
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  customer_email: customerId ? undefined : user.email,
  line_items: [{ price: priceId, quantity: 1 }],
  mode: "subscription",
  subscription_data: {
    trial_period_days: 14,
  },
  success_url: ...,
  cancel_url: ...,
});
```


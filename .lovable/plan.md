

# Plano de Monetizacao - LearnFlip AI

## Visao Geral

Com base nas funcionalidades existentes do sistema (salas de aula, geracao de quizzes por IA, correcao automatica, revisao por pares, forum, analytics e calendario), proponho um modelo de monetizacao baseado em planos por assinatura (SaaS) com limites progressivos.

---

## Modelo de Planos

### Plano Gratuito (Free)
- 1 sala ativa
- Ate 30 alunos por sala
- 3 geracoes de quiz por IA por mes
- 5 correcoes por IA por mes
- Materiais: apenas links e videos do YouTube
- Sem analytics avancado
- Sem revisao por pares
- Forum basico

### Plano Professor (R$ 29,90/mes)
- 5 salas ativas
- Ate 60 alunos por sala
- 30 geracoes de quiz por IA por mes
- 100 correcoes por IA por mes
- Upload de arquivos (PDF, DOCX, PPTX)
- Analytics completo com relatorio de alunos em risco
- Revisao por pares
- Feedback qualitativo do professor
- Banco de questoes pessoal
- Calendario de salas
- Suporte por email

### Plano Institucional (R$ 149,90/mes)
- Salas ilimitadas
- Alunos ilimitados
- Geracoes e correcoes por IA ilimitadas
- Todos os tipos de material
- Todas as funcionalidades
- Painel administrativo com multiplos professores
- Analytics cruzado entre salas
- Exportacao de relatorios
- Suporte prioritario
- Logo personalizado (white-label basico)

---

## Implementacao Tecnica

### 1. Tabela de planos e assinaturas

Criar tabelas `plans` e `subscriptions` no banco de dados para controlar qual professor tem acesso a quais funcionalidades e limites.

```text
plans                          subscriptions
+----------+                   +----------------+
| id       |                   | id             |
| name     |<------------------| plan_id        |
| price    |                   | user_id        |
| limits   |                   | status         |
| features |                   | current_period |
+----------+                   +----------------+
```

### 2. Integracao com Stripe

Usar a integracao nativa do Stripe disponivel no Lovable para:
- Criar produtos e precos para cada plano
- Gerenciar checkout e portal de assinatura
- Webhooks para ativar/desativar planos automaticamente

### 3. Middleware de limites (Feature Gates)

Adicionar verificacoes nos pontos criticos do sistema:
- **Criacao de sala**: verificar limite de salas ativas
- **Geracao de quiz**: verificar contador mensal de geracoes IA
- **Correcao por IA**: verificar contador mensal de correcoes
- **Upload de arquivo**: verificar se o plano permite
- **Analytics/Peer Review**: verificar se a funcionalidade esta liberada

### 4. Pagina de Pricing

Criar uma pagina `/pricing` com os 3 planos lado a lado, destacando o plano recomendado (Professor), com botao de assinar que redireciona para o checkout do Stripe.

### 5. Painel de uso

Adicionar no Dashboard do professor indicadores de consumo:
- "Voce usou 2/3 geracoes de IA este mes"
- "3/5 salas ativas"
- Barra de progresso visual com alerta quando proximo do limite

### 6. Trial gratuito

Oferecer 14 dias do Plano Professor gratis para novos cadastros, incentivando a conversao.

---

## Sequencia de Implementacao

1. Habilitar integracao Stripe no projeto
2. Criar tabelas `plans` e `subscriptions` no banco
3. Criar Edge Function para webhook do Stripe (ativar/cancelar assinaturas)
4. Criar pagina de Pricing com checkout
5. Implementar feature gates nos componentes existentes (RoomManage, Dashboard, geracoes IA)
6. Adicionar painel de uso no Dashboard
7. Implementar logica de trial de 14 dias
8. Testar fluxo completo: cadastro -> trial -> checkout -> uso -> limites

---

## Estimativa de Esforco

| Etapa | Complexidade |
|-------|-------------|
| Integracao Stripe + tabelas | Media |
| Pagina de Pricing | Baixa |
| Feature gates | Media |
| Painel de uso | Baixa |
| Trial gratuito | Baixa |
| **Total estimado** | **5-7 interacoes** |


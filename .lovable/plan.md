

## Diferenciar Analytics entre Planos e Atualizar Pagina de Precos

### Problema Atual
O componente `CrossRoomAnalytics` (comparacao entre salas) e exibido para qualquer usuario com 2+ salas, sem restricao de plano. Nao ha diferenca real entre o analytics do Professor e do Institucional, exceto os botoes de exportacao.

### O que muda

**Plano Professor -- Analytics Individual:**
- Cards de resumo (salas, alunos, concluidos, taxa geral, tempo medio)
- Tendencia de engajamento (ultimos 14 dias)
- Detalhamento sala a sala (expandir para ver desempenho por questao)
- Relatorio por sala (tempo por material, alunos em risco, distribuicao de notas)

**Plano Institucional -- Analytics Completo (tudo acima +):**
- Comparacao cruzada entre salas (graficos lado a lado de conclusao e media)
- Alertas de salas com baixa conclusao (<50%)
- Exportacao de relatorios (CSV e PDF)
- Ranking de salas por desempenho
- Metricas agregadas de todos os professores vinculados (via Dashboard Institucional)

### Alteracoes Planejadas

**1. `src/hooks/useFeatureGate.ts`**
- Adicionar funcao `canUseCrossRoomAnalytics()` que retorna `true` apenas para plano `institutional`

**2. `src/pages/AnalyticsPage.tsx`**
- Condicionar a renderizacao de `CrossRoomAnalytics` a `canUseCrossRoomAnalytics()`
- Quando o professor nao tem acesso, exibir um card de preview borrado com botao "Fazer upgrade para Institucional" no lugar do componente de comparacao cruzada

**3. `src/pages/Pricing.tsx`**
- Atualizar as features listadas para serem mais descritivas:
  - Professor: trocar "Analytics completo" por "Analytics por sala (engajamento, desempenho por questao, alunos em risco)"
  - Institucional: trocar "Analytics cruzado entre salas" por "Analytics cruzado entre salas (comparacao de conclusao, media, alertas de baixa performance)" e adicionar "Ranking de salas por desempenho"

### Detalhes Tecnicos

- Nova funcao no `useFeatureGate`: `canUseCrossRoomAnalytics = useCallback(() => effectivePlan === "institutional", [effectivePlan])`
- No `AnalyticsPage`, importar `canUseCrossRoomAnalytics` e usar condicionalmente no bloco que renderiza `CrossRoomAnalytics`
- O card de upgrade usara `blur` CSS com overlay centralizado contendo icone, texto e botao de navegacao para `/pricing`
- Nenhuma alteracao de banco de dados necessaria


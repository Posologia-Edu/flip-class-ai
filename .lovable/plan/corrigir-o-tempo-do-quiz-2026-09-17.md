# Corrigir o tempo do quiz

## Diagnóstico
- A conclusão da atividade e o tempo do quiz são gravados em solicitações separadas.
- O registro de tempo não é aguardado antes da conclusão; assim, o painel pode receber “Concluído” sem o tempo correspondente.
- O início do cronômetro existe apenas na memória da página e pode ser perdido ao recarregar ou retomar a atividade.

## Implementação
- Manter o tempo ativo do quiz de forma persistente durante a sessão, contando somente enquanto a atividade estiver visível.
- Enviar o tempo junto com a conclusão da atividade.
- No servidor, salvar a conclusão e o registro `quiz_complete` no mesmo fluxo, evitando a condição de corrida.
- Não criar registros duplicados quando um envio for repetido.
- No painel do professor, calcular um tempo de contingência usando o início do quiz e a conclusão da sessão para registros históricos sem duração.

## Validação
- Confirmar que uma atividade concluída exibe tempo maior que zero.
- Confirmar que recarregar a página durante o quiz não zera o cronômetro.
- Executar a compilação do aplicativo e validar os dados da sala afetada.

---
name: Teacher Copilot
description: Chat IA flutuante no RoomManage com contexto real da sala (alunos, notas, atividades, materiais, simulações)
type: feature
---
Botão flutuante (bottom-right) em `RoomManage` abre Sheet com chat IA para o professor/colaborador.

- Edge function: `teacher-copilot` (requer auth; valida owner OU `is_room_collaborator`)
- Contexto montado server-side: room, student_sessions (até 200), activities, materials, simulations + sessions resumo, teacher_feedback contagem, nota média, alunos em risco (<6)
- AI Fallback existente (Gemini → Groq → OpenAI → OpenRouter → Anthropic; Lovable só como último fallback)
- Histórico de conversa em `localStorage` por sala: `copilot:{roomId}` (últimas 16 mensagens enviadas ao backend)
- UI: `src/components/CopilotPanel.tsx`, renderiza markdown via `react-markdown`
- Logs em `ai_usage_log` com `prompt_type='teacher_copilot'`

Sugestões pré-definidas: alunos em risco, conceitos mais errados, gerar questões, escrever e-mail acolhedor.

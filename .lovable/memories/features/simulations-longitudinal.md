---
name: Longitudinal Simulations
description: Paciente virtual persistente em múltiplos capítulos; estado clínico evolui conforme decisões do aluno
type: feature
---
Simulações podem ser **longitudinais** (toggle no criador): o caso clínico se desenvolve em N capítulos (2-8). Cada capítulo tem até `max_steps` decisões. Ao terminar um capítulo, a IA gera:
- `chapter_summary` (resumo do capítulo)
- `chapter_score` (nota parcial 0-10)
- `patient_state_update` (atualização do estado clínico: vitais, exames, narrative_summary)

Status da `simulation_sessions`: `in_progress` → `chapter_ended` (entre capítulos, aguardando aluno) → `in_progress` (próximo capítulo via action=next_chapter) → `completed` no último capítulo.

Schema:
- `simulations.is_longitudinal`, `simulations.total_chapters`, `simulations.baseline_state` (estrutura inicial paciente: patient/clinical/social/narrative_summary)
- `simulation_sessions.chapter` (atual), `simulation_sessions.patient_state` (estado vivo), `simulation_sessions.chapters_history` (snapshots: summary, score, history)

O intro do capítulo corrente é guardado em `patient_state.__current_chapter_intro` (initial_situation + initial_options) para evitar migration de coluna extra.

Edge fns: `generate-simulation` (cria capítulo 1 + baseline), `simulation-step` (actions: start, step, next_chapter).

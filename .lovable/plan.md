

## Integração com YouTube Transcript API

### Problema atual
Quando o professor quer gerar uma atividade a partir de um vídeo do YouTube, o sistema abre um dialog pedindo para colar manualmente a transcrição. Isso é trabalhoso e interrompe o fluxo.

### Solução
Integrar com a API do youtube-transcript.io para buscar a transcrição automaticamente. O fluxo passará a ser: professor clica em "Gerar Atividade" no vídeo do YouTube, o sistema extrai o video ID, chama a API de transcrição via Edge Function, e gera a atividade diretamente --- sem dialog manual.

### Pré-requisito
O professor precisará fornecer a chave de API do youtube-transcript.io (obtida em youtube-transcript.io/profile). Essa chave será armazenada como secret no backend.

### Implementação

**1. Adicionar secret `YOUTUBE_TRANSCRIPT_API_KEY`**
- Solicitar ao usuário a chave de API via ferramenta de secrets

**2. Criar Edge Function `youtube-transcript`**
- Arquivo: `supabase/functions/youtube-transcript/index.ts`
- Recebe um `videoId`, faz POST para `https://www.youtube-transcript.io/api/transcripts` com header `Authorization: Basic <token>` e body `{"ids": ["<videoId>"]}`
- Retorna o texto da transcrição concatenado

**3. Atualizar fluxo no `RoomManage.tsx`**
- Na função `proceedWithGeneration`, quando o material é um link do YouTube:
  1. Extrair o video ID
  2. Chamar a Edge Function `youtube-transcript` para obter a transcrição
  3. Se sucesso: salvar em `content_text_for_ai` e chamar `generateQuizDirect` diretamente (sem abrir dialog)
  4. Se falha (vídeo sem legendas, erro de API): fallback para o dialog manual atual com mensagem explicativa
- Adicionar estado de loading ("Transcrevendo vídeo...") durante a busca

### Fluxo do usuário (após integração)

```text
Professor clica "Gerar Atividade" no vídeo
  → Seleciona tipo (Quiz / Casos Clínicos)
  → Sistema busca transcrição automaticamente
  → Se OK: gera atividade direto
  → Se falha: abre dialog manual (fallback atual)
```

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/youtube-transcript/index.ts` | Nova Edge Function para chamar API do youtube-transcript.io |
| `src/pages/RoomManage.tsx` | Chamar transcrição automática antes de abrir dialog manual |


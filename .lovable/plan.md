

# Revisao Completa de UX e Onboarding do FlipClass

## Problemas Identificados

### 1. Onboarding Inexistente para Professores
Quando um professor novo acessa o Dashboard pela primeira vez, ele ve um painel vazio sem nenhuma orientacao do que fazer. Nao ha tour guiado, dicas contextuais ou um passo-a-passo para criar a primeira sala.

### 2. Pagina de Login sem "Esqueci minha Senha"
A pagina `/auth` e o FloatingAuth nao possuem link de "Esqueci minha senha". O professor que esquecer a senha fica sem saida.

### 3. Dashboard Vazio sem Call-to-Action
Quando o professor nao tem salas, o Dashboard mostra apenas zeros nos cards de estatisticas. Deveria exibir um estado vazio com orientacao e botao para criar a primeira sala.

### 4. FloatingAuth e Auth Compartilham Estado de Form
O FloatingAuth na landing page compartilha campos de email/senha entre as abas Login e Cadastro, o que pode confundir o usuario.

### 5. Pagina Pending Approval sem Contexto
A pagina `/pending-approval` e muito simples. Nao informa tempo estimado nem da opcao de contato com admin.

### 6. MyAccount nao Sincroniza Nome Inicial
O campo `newName` e inicializado com `fullName` do auth context, mas se o contexto carrega depois do mount, o campo fica vazio.

### 7. Feedback Visual Insuficiente nos Formularios
Formularios de login, cadastro e reset de senha nao desabilitam o botao durante o loading de forma consistente e nao limpam os campos apos sucesso.

### 8. Falta de Navegacao na Landing Page para Professores
A landing page e focada apenas no aluno (PIN). Professores precisam localizar o botao "Entrar" no canto, sem nenhum CTA visivel abaixo do hero.

---

## Plano de Melhorias

### Tarefa 1: Onboarding do Professor (Dashboard Vazio)
Quando `rooms.length === 0`, exibir um componente de boas-vindas com:
- Titulo "Bem-vindo ao FlipClass!"
- 3 passos ilustrados: Criar Sala -> Adicionar Materiais -> Compartilhar PIN
- Botao principal "Criar Minha Primeira Sala" que redireciona para `/dashboard/rooms`

**Arquivo:** `src/pages/Dashboard.tsx`

### Tarefa 2: Link "Esqueci minha Senha"
Adicionar link "Esqueci minha senha" no formulario de login em:
- `src/pages/Auth.tsx` -- abaixo do campo de senha
- `src/components/FloatingAuth.tsx` -- abaixo do botao Entrar

Ao clicar, chama `supabase.auth.resetPasswordForEmail(email)` com feedback via toast. O link do email redireciona para `/reset-password`.

**Arquivos:** `src/pages/Auth.tsx`, `src/components/FloatingAuth.tsx`

### Tarefa 3: Secao CTA para Professores na Landing Page
Adicionar uma secao abaixo do hero com:
- Titulo "E professor? Crie salas inteligentes"
- Breve descricao das funcionalidades
- Botao "Comecar como Professor" que leva para `/auth`

**Arquivo:** `src/pages/Index.tsx`

### Tarefa 4: Melhorar Pagina Pending Approval
- Adicionar uma animacao sutil no icone
- Texto informando que o processo leva ate 24h uteis
- Link mailto para contato com administrador

**Arquivo:** `src/pages/PendingApproval.tsx`

### Tarefa 5: Sincronizar Nome no MyAccount
Usar `useEffect` para atualizar `newName` quando `fullName` mudar no contexto, evitando campo vazio no carregamento.

**Arquivo:** `src/pages/MyAccount.tsx`

### Tarefa 6: Separar Estados de Form no FloatingAuth
Criar estados independentes para email/senha em cada aba (login vs signup) para evitar que dados de uma aba contaminem a outra.

**Arquivo:** `src/components/FloatingAuth.tsx`

---

## Detalhes Tecnicos

### Dashboard vazio (Tarefa 1)
```text
// Dentro de Dashboard.tsx, apos o loading e quando rooms.length === 0:
<div className="text-center py-16 space-y-6">
  <h2>Bem-vindo ao FlipClass!</h2>
  <p>Siga 3 passos para comecar:</p>
  <div className="grid grid-cols-3 gap-6">
    [Passo 1: Criar Sala] [Passo 2: Adicionar Materiais] [Passo 3: Compartilhar PIN]
  </div>
  <Button onClick={() => navigate("/dashboard/rooms")}>
    Criar Minha Primeira Sala
  </Button>
</div>
```

### Esqueci minha senha (Tarefa 2)
```text
// Em Auth.tsx, dentro do form quando isLogin === true, adicionar:
<button type="button" onClick={handleForgotPassword}
  className="text-xs text-primary hover:underline">
  Esqueci minha senha
</button>

// Handler:
const handleForgotPassword = async () => {
  if (!email) {
    toast({ title: "Digite seu email primeiro" });
    return;
  }
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  toast({ title: "Email enviado!", description: "Verifique sua caixa para redefinir a senha." });
};
```

### MyAccount sync (Tarefa 5)
```text
// Adicionar useEffect:
useEffect(() => {
  if (fullName) setNewName(fullName);
}, [fullName]);
```

### FloatingAuth estados separados (Tarefa 6)
```text
// Substituir estados compartilhados por:
const [loginEmail, setLoginEmail] = useState("");
const [loginPassword, setLoginPassword] = useState("");
const [signupEmail, setSignupEmail] = useState("");
const [signupPassword, setSignupPassword] = useState("");
const [signupName, setSignupName] = useState("");
```


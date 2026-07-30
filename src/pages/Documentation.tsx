import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Users, Sparkles, ArrowLeft, GraduationCap, FileText,
  ClipboardCheck, Brain, Bell, BarChart3, MessageSquare, Star,
  Calendar, Shield, Settings, LogIn, PlusCircle, Eye, Pencil,
  CreditCard, Building2, FolderOpen, BookMarked, Server, Database,
  Code2, Layers, Key, Workflow, Globe, Lock, Cpu, HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Section = ({ icon: Icon, title, children, id }: { icon: any; title: string; children: React.ReactNode; id: string }) => (
  <motion.section
    id={id}
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.4 }}
    className="scroll-mt-24"
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h2 className="font-display text-2xl font-bold text-foreground">{title}</h2>
    </div>
    <div className="pl-[52px] text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </motion.section>
);

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="flex gap-3 items-start">
    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">{n}</span>
    <p>{children}</p>
  </div>
);

const navItems = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "aluno-entrar", label: "Entrar na Sala" },
  { id: "aluno-materiais", label: "Materiais" },
  { id: "aluno-quiz", label: "Quiz & Atividades" },
  { id: "aluno-peer-review", label: "Avaliação por Pares" },
  { id: "aluno-notificacoes", label: "Notificações" },
  { id: "aluno-discussao", label: "Fórum" },
  { id: "professor-login", label: "Login Professor" },
  { id: "professor-salas", label: "Gerenciar Salas" },
  { id: "professor-materiais", label: "Materiais" },
  { id: "professor-atividades", label: "Atividades & Quiz" },
  { id: "professor-correcao", label: "Correção com IA" },
  { id: "professor-banco", label: "Banco de Atividades" },
  { id: "professor-analytics", label: "Relatórios" },
  { id: "professor-calendario", label: "Calendário" },
  { id: "planos", label: "Planos & Assinatura" },
  { id: "institucional", label: "Painel Institucional" },
  { id: "admin", label: "Painel Admin" },
  { id: "tech-stack", label: "Stack Tecnológica" },
  { id: "tech-db", label: "Banco de Dados" },
  { id: "tech-auth", label: "Autenticação" },
  { id: "tech-edge", label: "Backend Functions" },
  { id: "tech-ai", label: "Integração IA" },
  { id: "tech-storage", label: "Armazenamento" },
  { id: "tech-frontend", label: "Frontend" },
  { id: "tech-deploy", label: "Deploy & Infra" },
];

const Documentation = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold text-foreground">FlipClass — Documentação</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            Voltar ao Início
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex gap-8 px-6 py-8">
        {/* Sidebar Nav */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Navegação</p>
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-sm text-muted-foreground hover:text-foreground hover:bg-secondary px-3 py-1.5 rounded-lg transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 space-y-12">
          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-transparent rounded-2xl p-8 border border-border">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
                Documentação do FlipClass
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Guia completo para alunos e professores utilizarem todas as funcionalidades da plataforma de Sala de Aula Invertida com IA.
              </p>
            </div>
          </motion.div>

          {/* Visão Geral */}
          <Section icon={Sparkles} title="Visão Geral" id="visao-geral">
            <p>
              O <strong className="text-foreground">FlipClass</strong> é uma plataforma de sala de aula invertida que utiliza Inteligência Artificial para gerar atividades, corrigir respostas abertas e personalizar a experiência de aprendizagem.
            </p>
            <p>O sistema possui três perfis de usuário:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Aluno</strong> — acessa salas pelo PIN, estuda materiais e responde quizzes.</li>
              <li><strong className="text-foreground">Professor</strong> — cria salas, faz upload de materiais, gera atividades por IA e corrige respostas.</li>
              <li><strong className="text-foreground">Administrador</strong> — aprova cadastros de professores e gerencia o sistema.</li>
            </ul>
          </Section>

          {/* ===== SEÇÃO DO ALUNO ===== */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <GraduationCap className="w-6 h-6 text-primary" />
              <h2 className="font-display text-xl font-bold text-foreground uppercase tracking-wider">Guia do Aluno</h2>
            </div>

            <div className="space-y-10">
              <Section icon={LogIn} title="Entrar na Sala" id="aluno-entrar">
                <p>Para acessar uma sala de aula, você <strong className="text-foreground">não precisa criar conta</strong>. Basta seguir os passos:</p>
                <Step n={1}>Na página inicial, digite o <strong className="text-foreground">PIN de 6 dígitos</strong> fornecido pelo professor.</Step>
                <Step n={2}>Clique em <strong className="text-foreground">"Entrar"</strong>.</Step>
                <Step n={3}>Preencha seu <strong className="text-foreground">nome completo</strong> e <strong className="text-foreground">email</strong>.</Step>
                <Step n={4}>Clique em <strong className="text-foreground">"Começar"</strong> para acessar a sala.</Step>
                <p className="text-sm bg-secondary/50 rounded-lg p-3 border border-border">
                  💡 <strong className="text-foreground">Dica:</strong> Se a sala tiver um horário de desbloqueio agendado, o conteúdo ficará acessível apenas após esse horário.
                </p>
              </Section>

              <Section icon={FileText} title="Estudar Materiais" id="aluno-materiais">
                <p>Ao entrar na sala, você verá a lista de materiais disponibilizados pelo professor. Os materiais podem ser:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">Vídeos do YouTube</strong> — reproduzidos diretamente na plataforma.</li>
                  <li><strong className="text-foreground">PDFs</strong> — abertos em uma nova aba ou visualizador integrado.</li>
                  <li><strong className="text-foreground">Links externos</strong> — redirecionam para o conteúdo externo.</li>
                </ul>
                <p>Estude todo o material antes de iniciar as atividades. A plataforma registra seu engajamento com os materiais.</p>
              </Section>

              <Section icon={ClipboardCheck} title="Quiz & Atividades" id="aluno-quiz">
                <p>Após estudar os materiais, você pode responder a atividade (quiz) gerada por IA. Tipos de questão:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">Múltipla escolha</strong> — selecione a alternativa correta.</li>
                  <li><strong className="text-foreground">Resposta aberta</strong> — escreva sua resposta detalhada.</li>
                  <li><strong className="text-foreground">Verdadeiro ou Falso</strong> — marque V ou F.</li>
                </ul>
                <Step n={1}>Leia cada pergunta com atenção.</Step>
                <Step n={2}>Preencha sua resposta no campo correspondente.</Step>
                <Step n={3}>Ao finalizar todas, clique em <strong className="text-foreground">"Enviar Respostas"</strong>.</Step>
                <p className="text-sm bg-secondary/50 rounded-lg p-3 border border-border">
                  ⚠️ <strong className="text-foreground">Atenção:</strong> Após enviar, suas respostas não podem ser alteradas. Revise com cuidado antes de submeter.
                </p>
              </Section>

              <Section icon={Star} title="Avaliação por Pares (Peer Review)" id="aluno-peer-review">
                <p>Se o professor ativar a avaliação por pares, após enviar suas respostas você poderá avaliar as respostas de colegas:</p>
                <Step n={1}>Acesse a aba <strong className="text-foreground">"Avaliação por Pares"</strong> na sala.</Step>
                <Step n={2}>Leia as respostas atribuídas a você.</Step>
                <Step n={3}>Avalie cada critério com uma nota de 1 a 5 estrelas.</Step>
                <Step n={4}>Adicione um comentário construtivo (opcional mas recomendado).</Step>
                <Step n={5}>Clique em <strong className="text-foreground">"Enviar Avaliação"</strong>.</Step>
              </Section>

              <Section icon={Bell} title="Notificações" id="aluno-notificacoes">
                <p>O ícone de <strong className="text-foreground">sino 🔔</strong> no canto superior mostra suas notificações em tempo real. Exemplos:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Novo material adicionado à sala.</li>
                  <li>Sala prestes a ser desbloqueada.</li>
                  <li>Atividade disponível para responder.</li>
                </ul>
                <p>Clique no sino para ver todas as notificações. Use <strong className="text-foreground">"Marcar todas como lidas"</strong> para limpar o contador.</p>
              </Section>

              <Section icon={MessageSquare} title="Fórum de Discussão" id="aluno-discussao">
                <p>Cada sala possui um fórum onde alunos e professores podem discutir o conteúdo:</p>
                <Step n={1}>Acesse a aba <strong className="text-foreground">"Fórum"</strong> na sala.</Step>
                <Step n={2}>Escreva sua mensagem e clique em <strong className="text-foreground">"Enviar"</strong>.</Step>
                <Step n={3}>Para responder a uma mensagem, clique em <strong className="text-foreground">"Responder"</strong> abaixo dela.</Step>
                <p>As mensagens do professor aparecem com um destaque especial para fácil identificação.</p>
              </Section>
            </div>
          </div>

          {/* ===== SEÇÃO DO PROFESSOR ===== */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-6 h-6 text-primary" />
              <h2 className="font-display text-xl font-bold text-foreground uppercase tracking-wider">Guia do Professor</h2>
            </div>

            <div className="space-y-10">
              <Section icon={Shield} title="Login e Aprovação" id="professor-login">
                <p>Para usar a plataforma como professor:</p>
                <Step n={1}>Acesse <strong className="text-foreground">"Área do Professor"</strong> na página inicial.</Step>
                <Step n={2}>Crie uma conta com email e senha.</Step>
                <Step n={3}>Após o cadastro, aguarde a <strong className="text-foreground">aprovação de um administrador</strong>.</Step>
                <Step n={4}>Quando aprovado, faça login normalmente para acessar o painel.</Step>
                <p className="text-sm bg-secondary/50 rounded-lg p-3 border border-border">
                  🔒 <strong className="text-foreground">Segurança:</strong> Apenas professores aprovados podem criar salas e acessar dados de alunos.
                </p>
              </Section>

              <Section icon={PlusCircle} title="Criar e Gerenciar Salas" id="professor-salas">
                <p>No painel do professor (Dashboard), você pode criar e gerenciar suas salas:</p>
                <Step n={1}>Clique em <strong className="text-foreground">"Nova Sala"</strong>.</Step>
                <Step n={2}>Dê um <strong className="text-foreground">título</strong> à sala e, opcionalmente, defina uma <strong className="text-foreground">data de desbloqueio</strong>.</Step>
                <Step n={3}>Um <strong className="text-foreground">PIN de 6 dígitos</strong> será gerado automaticamente — compartilhe com seus alunos.</Step>
                <Step n={4}>Clique no card da sala para acessar a <strong className="text-foreground">gestão completa</strong> (materiais, atividades, respostas).</Step>
                <p>Na gestão da sala, use as abas para navegar entre as diferentes funcionalidades.</p>
              </Section>

              <Section icon={FileText} title="Upload de Materiais" id="professor-materiais">
                <p>Na aba <strong className="text-foreground">"Materiais"</strong> da sala:</p>
                <Step n={1}>Clique em <strong className="text-foreground">"Adicionar Material"</strong>.</Step>
                <Step n={2}>Escolha o tipo: <strong className="text-foreground">YouTube, PDF ou Link</strong>.</Step>
                <Step n={3}>Cole a URL e dê um título ao material.</Step>
                <Step n={4}>Opcionalmente, cole o <strong className="text-foreground">conteúdo textual</strong> do material para que a IA use como base na geração de quizzes.</Step>
                <p className="text-sm bg-secondary/50 rounded-lg p-3 border border-border">
                  💡 <strong className="text-foreground">Dica:</strong> Quanto mais conteúdo textual você fornecer, melhor será a qualidade das questões geradas pela IA.
                </p>
              </Section>

              <Section icon={Brain} title="Atividades & Geração de Quiz por IA" id="professor-atividades">
                <p>Na aba <strong className="text-foreground">"Atividades"</strong>, crie quizzes automaticamente:</p>
                <Step n={1}>Selecione os <strong className="text-foreground">materiais base</strong> para a atividade.</Step>
                <Step n={2}>Escolha o <strong className="text-foreground">número de questões</strong> e os <strong className="text-foreground">tipos</strong> (múltipla escolha, aberta, V/F).</Step>
                <Step n={3}>Clique em <strong className="text-foreground">"Gerar Quiz com IA"</strong>.</Step>
                <Step n={4}>Revise as questões geradas — você pode <strong className="text-foreground">editar, remover ou adicionar</strong> questões manualmente.</Step>
                <Step n={5}>Salve a atividade. Os alunos poderão respondê-la ao acessar a sala.</Step>
                <p>Você também pode ativar a <strong className="text-foreground">avaliação por pares</strong> para que alunos avaliem as respostas uns dos outros.</p>
              </Section>

              <Section icon={Pencil} title="Correção Automática com IA (Rubrica)" id="professor-correcao">
                <p>Para questões de resposta aberta, a IA pode fornecer <strong className="text-foreground">correção preliminar</strong>:</p>
                <Step n={1}>Na aba <strong className="text-foreground">"Respostas"</strong>, abra as respostas de um aluno.</Step>
                <Step n={2}>Clique em <strong className="text-foreground">"Corrigir com IA"</strong> ao lado de uma questão específica — ou use <strong className="text-foreground">"Corrigir Todas com IA"</strong> para avaliação em lote.</Step>
                <Step n={3}>A IA analisa a resposta comparando com o gabarito e retorna:</Step>
                <ul className="list-disc list-inside space-y-1 ml-6">
                  <li><strong className="text-foreground">Nota sugerida</strong> (0 a 10)</li>
                  <li><strong className="text-foreground">Feedback qualitativo</strong></li>
                  <li><strong className="text-foreground">Pontos fortes e fracos</strong></li>
                  <li><strong className="text-foreground">Sugestão construtiva</strong></li>
                </ul>
                <Step n={4}>Revise a sugestão da IA, ajuste a nota e/ou feedback se necessário.</Step>
                <Step n={5}>Clique em <strong className="text-foreground">"Salvar Feedback"</strong> para finalizar a avaliação.</Step>
                <p className="text-sm bg-secondary/50 rounded-lg p-3 border border-border">
                  ⚠️ <strong className="text-foreground">Importante:</strong> A correção por IA é uma <em>sugestão</em>. O professor sempre tem a palavra final sobre a nota.
                </p>
              </Section>

              <Section icon={BarChart3} title="Relatórios e Analytics" id="professor-analytics">
                <p>Acompanhe o desempenho dos alunos em detalhes:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">Resumo da sala</strong> — total de alunos, taxa de conclusão, nota média.</li>
                  <li><strong className="text-foreground">Desempenho por questão</strong> — identifique perguntas com alto índice de erro.</li>
                  <li><strong className="text-foreground">Engajamento com materiais</strong> — veja quanto tempo cada aluno dedicou ao estudo.</li>
                  <li><strong className="text-foreground">Análise cruzada</strong> — compare desempenho entre diferentes salas.</li>
                </ul>
                <p>Os gráficos interativos permitem filtrar por período, aluno e tipo de atividade.</p>
              </Section>

              <Section icon={Calendar} title="Calendário de Salas" id="professor-calendario">
                <p>No Dashboard, o componente de <strong className="text-foreground">Calendário</strong> mostra:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Datas de desbloqueio agendadas para cada sala.</li>
                  <li>Visão mensal para planejar suas aulas invertidas.</li>
                </ul>
                <p>Clique em uma data para ver as salas agendadas para aquele dia.</p>
              </Section>

              <Section icon={FolderOpen} title="Banco de Atividades" id="professor-banco">
                <p>Salve e reutilize atividades entre diferentes salas:</p>
                <Step n={1}>Ao gerar ou criar uma atividade manualmente, clique em <strong className="text-foreground">"Salvar no Banco"</strong>.</Step>
                <Step n={2}>Acesse o <strong className="text-foreground">Banco de Atividades</strong> pelo menu lateral.</Step>
                <Step n={3}>Pesquise por título ou tags para encontrar atividades salvas.</Step>
                <Step n={4}>Visualize, edite ou <strong className="text-foreground">importe</strong> uma atividade para qualquer sala.</Step>
                <p className="text-sm bg-secondary/50 rounded-lg p-3 border border-border">
                  💡 <strong className="text-foreground">Dica:</strong> O Banco de Atividades está disponível nos planos <strong className="text-foreground">Professor</strong> e <strong className="text-foreground">Institucional</strong>.
                </p>
              </Section>
            </div>
          </div>

          {/* ===== PLANOS ===== */}
          <Section icon={CreditCard} title="Planos & Assinatura" id="planos">
            <p>O FlipClass oferece três planos:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-foreground">Gratuito</strong> — 1 sala, até 30 alunos, 3 gerações de IA e 5 correções por mês.</li>
              <li><strong className="text-foreground">Professor (R$ 29,90/mês)</strong> — até 5 salas, 60 alunos por sala, 30 gerações e 100 correções por IA, upload de arquivos, analytics avançado, avaliação por pares e banco de atividades.</li>
              <li><strong className="text-foreground">Institucional (R$ 149,90/mês)</strong> — salas e alunos ilimitados, IA ilimitada, até 10 professores convidados, painel institucional com análises cruzadas.</li>
            </ul>
            <p>Gerencie sua assinatura em <strong className="text-foreground">"Minha Conta"</strong> no menu lateral, ou acesse a página de <strong className="text-foreground">Preços</strong> pelo link na Home.</p>
          </Section>

          {/* ===== INSTITUCIONAL ===== */}
          <Section icon={Building2} title="Painel Institucional" id="institucional">
            <p>Disponível no plano <strong className="text-foreground">Institucional</strong>, permite gerenciar uma equipe de professores:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Convidar professores</strong> — envie convites por email. O professor convidado recebe acesso ao plano Professor automaticamente.</li>
              <li><strong className="text-foreground">Gerenciar equipe</strong> — visualize, ative ou revogue acessos dos professores convidados.</li>
              <li><strong className="text-foreground">Personalização</strong> — configure nome da instituição, logo e cor primária (white-label).</li>
              <li><strong className="text-foreground">Análises cruzadas</strong> — veja métricas agregadas de todas as salas de todos os professores convidados.</li>
            </ul>
            <p>Acesse pelo menu lateral em <strong className="text-foreground">"Institucional"</strong>.</p>
          </Section>

          {/* ===== SEÇÃO DO ADMIN ===== */}
          <Section icon={Shield} title="Painel do Administrador" id="admin">
            <p>O administrador tem acesso ao painel em <strong className="text-foreground">/admin</strong>, onde pode:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Aprovar ou rejeitar</strong> cadastros de novos professores.</li>
              <li><strong className="text-foreground">Visualizar</strong> a lista de todos os professores e seus status.</li>
              <li><strong className="text-foreground">Enviar convites</strong> — conceda acesso a um plano específico para qualquer email.</li>
              <li><strong className="text-foreground">Gerenciar assinantes</strong> — veja quem está pagando e quais planos possuem.</li>
              <li><strong className="text-foreground">Configurar chaves de IA</strong> — gerencie as API keys dos provedores de IA.</li>
            </ul>
            <p>Ao aprovar um professor, ele recebe acesso imediato ao Dashboard e pode começar a criar salas.</p>
          </Section>

          {/* ===== SEÇÃO TÉCNICA ===== */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Code2 className="w-6 h-6 text-primary" />
              <h2 className="font-display text-xl font-bold text-foreground uppercase tracking-wider">Documentação Técnica</h2>
            </div>
            <p className="text-muted-foreground mb-8 ml-8">
              Esta seção descreve a arquitetura, tecnologias, serviços de API e estrutura de banco de dados que sustentam o FlipClass.
            </p>

            <div className="space-y-10">
              <Section icon={Layers} title="Stack Tecnológica" id="tech-stack">
                <p>O FlipClass é construído com as seguintes tecnologias:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">React 18 + TypeScript</strong> — biblioteca de interface reativa com tipagem estática.</li>
                  <li><strong className="text-foreground">Vite</strong> — bundler e dev server ultra-rápido.</li>
                  <li><strong className="text-foreground">Tailwind CSS</strong> — framework CSS utility-first para estilização.</li>
                  <li><strong className="text-foreground">shadcn/ui + Radix UI</strong> — componentes acessíveis e personalizáveis (Dialog, Accordion, Tabs, etc.).</li>
                  <li><strong className="text-foreground">React Router v6</strong> — roteamento SPA com rotas protegidas.</li>
                  <li><strong className="text-foreground">TanStack Query (React Query)</strong> — gerenciamento de cache e fetching de dados assíncrono.</li>
                  <li><strong className="text-foreground">Framer Motion</strong> — animações declarativas de entrada e transição.</li>
                  <li><strong className="text-foreground">Recharts</strong> — gráficos interativos para analytics e relatórios.</li>
                  <li><strong className="text-foreground">Sonner</strong> — sistema de notificações toast.</li>
                </ul>
              </Section>

              <Section icon={Database} title="Estrutura do Banco de Dados" id="tech-db">
                <p>O sistema utiliza um banco <strong className="text-foreground">PostgreSQL</strong> gerenciado pela Lovable Cloud. As principais tabelas são:</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-border rounded-lg overflow-hidden mt-2">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border">Tabela</th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border">Descrição</th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border">Colunas Principais</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">rooms</td><td className="px-3 py-2">Salas de aula</td><td className="px-3 py-2 text-xs">id, teacher_id, title, pin_code, unlock_at, expire_at</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">materials</td><td className="px-3 py-2">Materiais de estudo</td><td className="px-3 py-2 text-xs">id, room_id, type, title, url, content_text_for_ai</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">activities</td><td className="px-3 py-2">Atividades e quizzes</td><td className="px-3 py-2 text-xs">id, room_id, quiz_data (JSONB), peer_review_enabled</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">student_sessions</td><td className="px-3 py-2">Sessões de alunos</td><td className="px-3 py-2 text-xs">id, room_id, student_name, student_email, answers (JSONB), score</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">student_activity_logs</td><td className="px-3 py-2">Logs de engajamento</td><td className="px-3 py-2 text-xs">id, session_id, room_id, activity_type, duration_seconds</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">teacher_feedback</td><td className="px-3 py-2">Feedback e notas do professor</td><td className="px-3 py-2 text-xs">id, session_id, question_key, grade, feedback_text</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">profiles</td><td className="px-3 py-2">Perfil de professores</td><td className="px-3 py-2 text-xs">id, user_id, full_name, approval_status</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">user_roles</td><td className="px-3 py-2">Papéis (admin, teacher)</td><td className="px-3 py-2 text-xs">id, user_id, role (enum: admin | teacher)</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">notifications</td><td className="px-3 py-2">Notificações em tempo real</td><td className="px-3 py-2 text-xs">id, room_id, session_id, type, title, message, read</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">discussion_posts</td><td className="px-3 py-2">Fórum de discussão</td><td className="px-3 py-2 text-xs">id, room_id, parent_id, author_name, content</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">peer_review_assignments</td><td className="px-3 py-2">Atribuições peer review</td><td className="px-3 py-2 text-xs">id, activity_id, reviewer_session_id, reviewee_session_id</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">peer_reviews</td><td className="px-3 py-2">Avaliações por pares</td><td className="px-3 py-2 text-xs">id, assignment_id, criteria_scores (JSONB), comment</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">question_bank</td><td className="px-3 py-2">Banco de atividades</td><td className="px-3 py-2 text-xs">id, teacher_id, quiz_data (JSONB), title, tags</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">admin_invites</td><td className="px-3 py-2">Convites administrativos</td><td className="px-3 py-2 text-xs">id, email, granted_plan, status, invited_by</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">ai_api_keys</td><td className="px-3 py-2">Chaves de API de IA</td><td className="px-3 py-2 text-xs">id, provider, api_key</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">ai_usage_log</td><td className="px-3 py-2">Log de uso de IA</td><td className="px-3 py-2 text-xs">id, user_id, usage_type, provider, model, tokens_input/output</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">page_views</td><td className="px-3 py-2">Analytics de visitantes</td><td className="px-3 py-2 text-xs">id, path, session_id, user_agent, referrer</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">room_students</td><td className="px-3 py-2">Whitelist de alunos</td><td className="px-3 py-2 text-xs">id, room_id, student_email, student_name</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">institution_settings</td><td className="px-3 py-2">Config. institucional</td><td className="px-3 py-2 text-xs">id, user_id, logo_url, institution_name, primary_color</td></tr>
                    </tbody>
                  </table>
                </div>

                <p className="mt-4">Todas as tabelas utilizam <strong className="text-foreground">Row-Level Security (RLS)</strong> para garantir que cada usuário acesse apenas os dados permitidos. A função <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">has_role(user_id, role)</code> é usada nas políticas de segurança para verificar permissões admin.</p>

                <p><strong className="text-foreground">Triggers automáticos:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">handle_new_user</code> — cria automaticamente um perfil quando um novo usuário se cadastra.</li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">update_room_last_activity</code> — atualiza o timestamp de última atividade da sala quando um aluno interage.</li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">notify_material_added</code> — gera notificação automática para alunos quando um material é adicionado.</li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">notify_activity_unlock</code> — notifica alunos quando uma sala é desbloqueada.</li>
                </ul>
              </Section>

              <Section icon={Lock} title="Autenticação e Autorização" id="tech-auth">
                <p>O sistema de autenticação é gerenciado pela Lovable Cloud com as seguintes características:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">Autenticação por email/senha</strong> — professores criam conta e fazem login via formulário padrão.</li>
                  <li><strong className="text-foreground">Verificação de email</strong> — obrigatória antes do primeiro login.</li>
                  <li><strong className="text-foreground">Fluxo de aprovação</strong> — após criar conta, o professor fica com status <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">pending</code> até ser aprovado por um admin.</li>
                  <li><strong className="text-foreground">Alunos sem conta</strong> — alunos acessam as salas usando PIN + nome + email, sem necessidade de autenticação.</li>
                  <li><strong className="text-foreground">Papéis</strong> — gerenciados pela tabela <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">user_roles</code> com enum <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">app_role</code> (admin, teacher).</li>
                  <li><strong className="text-foreground">Row-Level Security</strong> — todas as tabelas usam RLS para proteger dados no nível do banco.</li>
                </ul>
                <p className="text-sm bg-secondary/50 rounded-lg p-3 border border-border">
                  🔒 <strong className="text-foreground">Segurança:</strong> Papéis nunca são armazenados no perfil do usuário para evitar ataques de escalonamento de privilégio. A função <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">has_role()</code> usa <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">SECURITY DEFINER</code> para validar permissões sem recursão de RLS.
                </p>
              </Section>

              <Section icon={Server} title="Backend Functions (Edge Functions)" id="tech-edge">
                <p>O backend utiliza <strong className="text-foreground">Edge Functions</strong> serverless (Deno) para lógica de negócios. As funções disponíveis são:</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-border rounded-lg overflow-hidden mt-2">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border">Função</th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border">Descrição</th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border">Autenticação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">generate-quiz</td><td className="px-3 py-2">Gera quizzes e estudos de caso via IA a partir de materiais</td><td className="px-3 py-2 text-xs">JWT (público)</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">ai-grade</td><td className="px-3 py-2">Corrige respostas abertas com IA e retorna nota + feedback</td><td className="px-3 py-2 text-xs">JWT</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">student-session</td><td className="px-3 py-2">Gerencia sessões de alunos (criar, submeter, logs)</td><td className="px-3 py-2 text-xs">Token HMAC</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">check-subscription</td><td className="px-3 py-2">Verifica status da assinatura Stripe do usuário</td><td className="px-3 py-2 text-xs">JWT (público)</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">create-checkout</td><td className="px-3 py-2">Cria sessão de checkout Stripe para assinatura</td><td className="px-3 py-2 text-xs">JWT (público)</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">customer-portal</td><td className="px-3 py-2">Redireciona para o portal de gerenciamento Stripe</td><td className="px-3 py-2 text-xs">JWT (público)</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">admin-invite</td><td className="px-3 py-2">Envia convites administrativos por email</td><td className="px-3 py-2 text-xs">JWT (admin)</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">list-subscribers</td><td className="px-3 py-2">Lista assinantes ativos via Stripe</td><td className="px-3 py-2 text-xs">JWT (admin)</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">send-approval-email</td><td className="px-3 py-2">Envia email de aprovação ao professor</td><td className="px-3 py-2 text-xs">JWT (público)</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">send-contact</td><td className="px-3 py-2">Envia mensagem de contato por email</td><td className="px-3 py-2 text-xs">Público</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">check-deadlines</td><td className="px-3 py-2">Verifica prazos de salas e envia alertas</td><td className="px-3 py-2 text-xs">Cron</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">hub-metrics</td><td className="px-3 py-2">Retorna métricas agregadas do sistema</td><td className="px-3 py-2 text-xs">API Key</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">institutional-dashboard</td><td className="px-3 py-2">Dados do painel institucional multi-professor</td><td className="px-3 py-2 text-xs">JWT (público)</td></tr>
                      <tr><td className="px-3 py-2 font-mono text-xs text-primary">auth-email-hook</td><td className="px-3 py-2">Hook de email customizado (templates de signup, recovery, etc.)</td><td className="px-3 py-2 text-xs">Webhook</td></tr>
                    </tbody>
                  </table>
                </div>

                <p className="mt-3">As funções que exigem autenticação usam o token JWT do usuário logado. Funções marcadas como "público" não verificam JWT (configurado em <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">config.toml</code>).</p>
              </Section>

              <Section icon={Cpu} title="Integração com IA" id="tech-ai">
                <p>O sistema utiliza IA para duas funcionalidades principais:</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>
                    <strong className="text-foreground">Geração de quiz/atividade</strong> — A função <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">generate-quiz</code> envia o conteúdo dos materiais para um modelo de IA que gera questões no formato JSON estruturado.
                  </li>
                  <li>
                    <strong className="text-foreground">Correção automática</strong> — A função <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">ai-grade</code> compara respostas do aluno com o gabarito e retorna nota, feedback e análise qualitativa.
                  </li>
                </ul>
                <p><strong className="text-foreground">Mecanismo de fallback:</strong></p>
                <p>O módulo <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">ai-with-fallback.ts</code> tenta primeiro usar API keys configuradas pelo admin (OpenAI, Groq, Google, Anthropic, OpenRouter). Se nenhuma estiver disponível ou falhar, faz fallback automático para o gateway Lovable AI.</p>
                <p><strong className="text-foreground">Provedores suportados:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">Lovable AI</strong> (gateway padrão — sem necessidade de API key)</li>
                  <li><strong className="text-foreground">OpenAI</strong> (GPT-4o, GPT-5)</li>
                  <li><strong className="text-foreground">Google</strong> (Gemini)</li>
                  <li><strong className="text-foreground">Anthropic</strong> (Claude)</li>
                  <li><strong className="text-foreground">Groq</strong> (Llama)</li>
                  <li><strong className="text-foreground">OpenRouter</strong> (multi-modelo)</li>
                </ul>
                <p><strong className="text-foreground">Limites por plano:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">Gratuito</strong> — 3 gerações e 5 correções por mês.</li>
                  <li><strong className="text-foreground">Professor</strong> — 30 gerações e 100 correções por mês.</li>
                  <li><strong className="text-foreground">Institucional</strong> — ilimitado.</li>
                </ul>
                <p>O uso é rastreado na tabela <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">ai_usage_log</code> com detalhes de tokens consumidos e custo estimado.</p>
              </Section>

              <Section icon={HardDrive} title="Armazenamento de Arquivos" id="tech-storage">
                <p>O sistema utiliza <strong className="text-foreground">Storage</strong> da Lovable Cloud para armazenar arquivos:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">Bucket <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">materials</code></strong> (privado) — armazena PDFs e arquivos enviados pelos professores. O acesso é feito via URLs assinadas temporárias geradas pela edge function <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">student-session</code>.</li>
                  <li><strong className="text-foreground">Bucket <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">logos</code></strong> (público) — armazena logos de instituições para o white-label.</li>
                </ul>
              </Section>

              <Section icon={Globe} title="Arquitetura Frontend" id="tech-frontend">
                <p>O frontend segue uma arquitetura modular:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">Páginas</strong> (<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">src/pages/</code>) — componentes de rota: Dashboard, RoomManage, StudentView, AdminPanel, etc.</li>
                  <li><strong className="text-foreground">Componentes</strong> (<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">src/components/</code>) — componentes reutilizáveis: AppSidebar, AnalyticsReport, DiscussionForum, PeerReview, etc.</li>
                  <li><strong className="text-foreground">UI Components</strong> (<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">src/components/ui/</code>) — sistema de design baseado em shadcn/ui com variáveis CSS semânticas.</li>
                  <li><strong className="text-foreground">Hooks</strong> (<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">src/hooks/</code>) — hooks customizados: useAuth, useSubscription, useFeatureGate, useCookieConsent.</li>
                  <li><strong className="text-foreground">Contexts</strong> (<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">src/contexts/</code>) — AuthContext para gerenciamento global de autenticação.</li>
                </ul>
                <p><strong className="text-foreground">Sistema de Feature Gates:</strong></p>
                <p>O hook <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">useFeatureGate</code> determina os limites de cada plano (salas, alunos, IA, features) e resolve o plano efetivo considerando assinatura Stripe e convites administrativos.</p>
              </Section>

              <Section icon={Workflow} title="Deploy & Infraestrutura" id="tech-deploy">
                <p>A infraestrutura do FlipClass é totalmente gerenciada:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-foreground">Hosting</strong> — Lovable Cloud (CDN global com HTTPS automático).</li>
                  <li><strong className="text-foreground">Banco de dados</strong> — PostgreSQL gerenciado com backups automáticos.</li>
                  <li><strong className="text-foreground">Edge Functions</strong> — deploy automático a cada commit (runtime Deno).</li>
                  <li><strong className="text-foreground">Pagamentos</strong> — Stripe para assinaturas recorrentes (checkout e portal do cliente).</li>
                  <li><strong className="text-foreground">Emails transacionais</strong> — Resend com templates customizados em React Email.</li>
                  <li><strong className="text-foreground">Monitoramento</strong> — Hub de métricas via edge function para acompanhamento externo.</li>
                </ul>
                <p><strong className="text-foreground">Secrets configurados:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">STRIPE_SECRET_KEY</code> — chave secreta do Stripe para pagamentos.</li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">RESEND_API_KEY</code> — chave da Resend para envio de emails.</li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">LOVABLE_API_KEY</code> — chave do gateway Lovable AI.</li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">HUB_METRICS_KEY</code> — chave de autenticação do hub de métricas.</li>
                  <li><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">HUB_SERVICE_KEY / HUB_SERVICE_ID</code> — credenciais do serviço hub.</li>
                </ul>
              </Section>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">Perguntas Frequentes</h2>
            </div>
            <div className="pl-[52px]">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="q1">
                  <AccordionTrigger>Preciso criar conta para entrar como aluno?</AccordionTrigger>
                  <AccordionContent>
                    Não. Basta digitar o PIN da sala e informar seu nome e email. Nenhuma senha é necessária.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q2">
                  <AccordionTrigger>Posso refazer o quiz depois de enviar?</AccordionTrigger>
                  <AccordionContent>
                    Não. As respostas são enviadas uma única vez. Revise com atenção antes de submeter.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q3">
                  <AccordionTrigger>Quanto tempo leva para minha conta de professor ser aprovada?</AccordionTrigger>
                  <AccordionContent>
                    Depende do administrador. Após o cadastro, você será redirecionado para uma página de espera. Assim que aprovado, terá acesso imediato ao Dashboard.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q4">
                  <AccordionTrigger>A correção da IA substitui o professor?</AccordionTrigger>
                  <AccordionContent>
                    Não. A IA fornece uma sugestão preliminar de nota e feedback. O professor sempre revisa e pode ajustar antes de salvar a avaliação final.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q5">
                  <AccordionTrigger>Como funciona a avaliação por pares?</AccordionTrigger>
                  <AccordionContent>
                    Quando ativada pelo professor, cada aluno recebe respostas de colegas para avaliar com critérios e nota de 1 a 5. Isso promove pensamento crítico e aprendizagem colaborativa.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q6">
                  <AccordionTrigger>O que é o "desbloqueio agendado" de uma sala?</AccordionTrigger>
                  <AccordionContent>
                    O professor pode definir uma data e hora futura para que o conteúdo da sala fique acessível. Antes desse horário, os alunos verão uma mensagem informando quando a sala será liberada.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q7">
                  <AccordionTrigger>Qual a diferença entre os planos Professor e Institucional?</AccordionTrigger>
                  <AccordionContent>
                    O plano Professor é individual, com até 5 salas e limites de IA. O plano Institucional permite convidar até 10 professores, salas e IA ilimitadas, além de um painel com análises cruzadas de toda a equipe.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q8">
                  <AccordionTrigger>O que é o Banco de Atividades?</AccordionTrigger>
                  <AccordionContent>
                    É um repositório pessoal onde o professor pode salvar atividades (quizzes, estudos de caso) e reutilizá-las em qualquer sala. Disponível nos planos Professor e Institucional.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q9">
                  <AccordionTrigger>Como funciona o convite de professores no plano Institucional?</AccordionTrigger>
                  <AccordionContent>
                    No Painel Institucional, digite o email do professor e envie o convite. Ele receberá um email com instruções para criar a conta. Ao se cadastrar, terá acesso automático às funcionalidades do plano Professor.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border pt-8 pb-12 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} FlipClass — Todos os direitos reservados.</p>
            <p className="mt-1">
              Desenvolvido por <strong className="text-foreground">Sérgio Araújo</strong> e <strong className="text-foreground">Posologia Produções</strong>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Documentation;

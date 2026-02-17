import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Users, Sparkles, ArrowLeft, GraduationCap, FileText,
  ClipboardCheck, Brain, Bell, BarChart3, MessageSquare, Star,
  Calendar, Shield, Settings, LogIn, PlusCircle, Eye, Pencil
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
  { id: "professor-analytics", label: "Relatórios" },
  { id: "professor-calendario", label: "Calendário" },
  { id: "admin", label: "Painel Admin" },
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
            </div>
          </div>

          {/* ===== SEÇÃO DO ADMIN ===== */}
          <Section icon={Shield} title="Painel do Administrador" id="admin">
            <p>O administrador tem acesso ao painel em <strong className="text-foreground">/admin</strong>, onde pode:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Aprovar ou rejeitar</strong> cadastros de novos professores.</li>
              <li><strong className="text-foreground">Visualizar</strong> a lista de todos os professores e seus status.</li>
              <li><strong className="text-foreground">Gerenciar permissões</strong> do sistema.</li>
            </ul>
            <p>Ao aprovar um professor, ele recebe acesso imediato ao Dashboard e pode começar a criar salas.</p>
          </Section>

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

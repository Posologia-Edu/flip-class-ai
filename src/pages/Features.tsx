import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Brain, ClipboardCheck, BarChart3, MessageSquare, Shield,
  Upload, Calendar, FolderOpen, Building2, ArrowRight, Sparkles,
  Users, Bell, Star, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/components/PublicFooter";
import FloatingAuth from "@/components/FloatingAuth";

const features = [
  {
    icon: Brain,
    title: "Geração de Quiz por IA",
    desc: "Crie atividades automaticamente a partir dos materiais enviados. A IA gera questões de múltipla escolha, verdadeiro/falso e dissertativas com diferentes níveis de dificuldade. Economize horas de trabalho na preparação de avaliações.",
    highlight: true,
  },
  {
    icon: ClipboardCheck,
    title: "Correção Automática com IA",
    desc: "Respostas dissertativas avaliadas por inteligência artificial com nota sugerida, feedback qualitativo, pontos fortes e fracos, e sugestões construtivas. O professor mantém o controle total sobre a nota final.",
    highlight: true,
  },
  {
    icon: BarChart3,
    title: "Analytics e Relatórios",
    desc: "Acompanhe em tempo real o engajamento dos alunos, taxa de conclusão, desempenho por questão e identifique alunos em risco. Exporte relatórios em CSV e PDF para análises mais detalhadas.",
    highlight: true,
  },
  {
    icon: Upload,
    title: "Materiais Diversificados",
    desc: "Suporte a vídeos do YouTube, PDFs, documentos DOCX, apresentações PPTX e links externos. Organize todo o conteúdo por sala com controle de publicação.",
  },
  {
    icon: Shield,
    title: "Avaliação por Pares (Peer Review)",
    desc: "Ative a avaliação entre pares com critérios personalizáveis. Os alunos avaliam as respostas dos colegas com notas e comentários construtivos, desenvolvendo pensamento crítico.",
  },
  {
    icon: MessageSquare,
    title: "Fórum de Discussão",
    desc: "Cada sala possui um fórum integrado para dúvidas e debates. As mensagens do professor são destacadas para fácil identificação. Suporte a respostas aninhadas.",
  },
  {
    icon: FolderOpen,
    title: "Banco de Atividades",
    desc: "Salve suas atividades em um repositório pessoal e reutilize-as em qualquer sala. Organize com tags e filtre rapidamente para encontrar o que precisa.",
  },
  {
    icon: Calendar,
    title: "Calendário de Salas",
    desc: "Visualize todas as suas salas em um calendário interativo. Veja datas de expiração, desbloqueio agendado e organize sua agenda acadêmica.",
  },
  {
    icon: Bell,
    title: "Notificações em Tempo Real",
    desc: "Alunos e professores recebem notificações instantâneas sobre novos materiais, atividades disponíveis, avaliações e prazos importantes.",
  },
  {
    icon: Users,
    title: "Acesso Simplificado para Alunos",
    desc: "Alunos entram na sala apenas com PIN + nome + email. Sem necessidade de criar conta, sem fricção. O professor compartilha o PIN e os alunos acessam instantaneamente.",
  },
  {
    icon: Building2,
    title: "Painel Institucional",
    desc: "Para instituições de ensino: gerencie múltiplos professores, visualize analytics cruzados entre salas, rankings de desempenho e aplique identidade visual personalizada (white-label).",
  },
  {
    icon: Zap,
    title: "Desbloqueio Agendado",
    desc: "Programe a liberação de conteúdo para uma data e hora específicas. Ideal para a metodologia de sala de aula invertida, onde o material deve ser estudado antes da aula presencial.",
  },
];

export default function Features() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">FlipClass</span>
        </Link>
        <FloatingAuth />
      </header>

      {/* Hero */}
      <section className="py-16 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Funcionalidades
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-tight mb-4">
            Tudo o que você precisa para a{" "}
            <span className="text-gradient-primary">sala de aula invertida</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
            Recursos poderosos com inteligência artificial para transformar sua forma de ensinar e avaliar. Da criação de quizzes à análise de desempenho.
          </p>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-12 px-6 flex-1">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`rounded-xl border p-6 transition-shadow hover:shadow-md ${
                  f.highlight
                    ? "bg-primary/5 border-primary/20"
                    : "bg-card border-border"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                  f.highlight ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                {f.highlight && (
                  <div className="mt-3">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                      ⭐ Destaque
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-card border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
            Pronto para transformar suas aulas?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
            Comece gratuitamente. Crie sua primeira sala, envie materiais e gere atividades com IA em minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="font-semibold" onClick={() => navigate("/auth")}>
              Criar Conta Grátis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" onClick={() => navigate("/planos")}>
              Ver Planos
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

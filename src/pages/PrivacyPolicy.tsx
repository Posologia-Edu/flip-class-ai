import { Link } from "react-router-dom";
import { BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/components/PublicFooter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">FlipClass</span>
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Início</Link>
        </Button>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 prose prose-sm dark:prose-invert">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <h2>1. Dados Coletados</h2>
        <p>Coletamos os seguintes dados:</p>
        <ul>
          <li><strong>Professores:</strong> nome completo, email e senha (criptografada).</li>
          <li><strong>Alunos:</strong> nome e email fornecidos ao entrar na sala (sem criação de conta).</li>
          <li><strong>Dados de uso:</strong> respostas a atividades, participação em fóruns, avaliações por pares e logs de atividade.</li>
          <li><strong>Dados técnicos:</strong> endereço IP, tipo de navegador e dados de sessão para funcionamento do serviço.</li>
        </ul>

        <h2>2. Finalidade do Tratamento</h2>
        <p>Os dados são utilizados para:</p>
        <ul>
          <li>Fornecer e operar os serviços da plataforma.</li>
          <li>Gerar relatórios de desempenho e analytics para professores.</li>
          <li>Processar respostas com inteligência artificial.</li>
          <li>Enviar notificações relacionadas à plataforma.</li>
          <li>Melhorar a qualidade do serviço.</li>
        </ul>

        <h2>3. Compartilhamento de Dados</h2>
        <p>Não vendemos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. Dados podem ser compartilhados com:</p>
        <ul>
          <li><strong>Provedores de IA</strong> — para processamento de quizzes e correções (dados anonimizados quando possível).</li>
          <li><strong>Provedores de pagamento</strong> — para processamento de assinaturas (Stripe).</li>
          <li><strong>Provedores de email</strong> — para envio de notificações e comunicações.</li>
        </ul>

        <h2>4. Armazenamento e Segurança</h2>
        <p>Os dados são armazenados em servidores seguros com criptografia em trânsito (TLS) e em repouso. Utilizamos políticas de acesso restrito (Row Level Security) para garantir que cada usuário acesse apenas seus próprios dados.</p>

        <h2>5. Retenção de Dados</h2>
        <p>Os dados são mantidos enquanto a conta estiver ativa. Dados de alunos em salas expiradas são mantidos por até 12 meses para fins de relatórios. Você pode solicitar a exclusão de seus dados a qualquer momento.</p>

        <h2>6. Direitos do Titular</h2>
        <p>Em conformidade com a LGPD (Lei Geral de Proteção de Dados), você tem direito a:</p>
        <ul>
          <li>Acessar seus dados pessoais.</li>
          <li>Corrigir dados incompletos ou desatualizados.</li>
          <li>Solicitar a exclusão de seus dados.</li>
          <li>Revogar o consentimento para tratamento de dados.</li>
          <li>Solicitar a portabilidade dos dados.</li>
        </ul>

        <h2>7. Dados de Menores</h2>
        <p>A plataforma é destinada a uso educacional. Dados de menores de idade são tratados sob responsabilidade do professor e/ou instituição de ensino, que devem garantir o consentimento dos responsáveis legais.</p>

        <h2>8. Contato do Encarregado (DPO)</h2>
        <p>Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato através da página de <Link to="/contato" className="text-primary hover:underline">Contato</Link> ou pelo email sergio.araujo@ufrn.br.</p>
      </main>

      <PublicFooter />
    </div>
  );
}

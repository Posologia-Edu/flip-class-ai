import { Link } from "react-router-dom";
import { BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/components/PublicFooter";

export default function TermsOfService() {
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
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Termos de Serviço</h1>
        <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <h2>1. Aceitação dos Termos</h2>
        <p>Ao acessar e utilizar a plataforma FlipClass, você concorda com estes Termos de Serviço. Se não concordar com qualquer parte destes termos, não utilize a plataforma.</p>

        <h2>2. Descrição do Serviço</h2>
        <p>O FlipClass é uma plataforma de sala de aula invertida que oferece ferramentas de ensino baseadas em inteligência artificial, incluindo geração de quizzes, correção automática de respostas, analytics de desempenho e fóruns de discussão.</p>

        <h2>3. Cadastro e Conta</h2>
        <p>Para utilizar as funcionalidades de professor, é necessário criar uma conta com informações verdadeiras e aguardar aprovação. Você é responsável por manter a confidencialidade de suas credenciais e por todas as atividades realizadas em sua conta.</p>

        <h2>4. Planos e Pagamentos</h2>
        <p>O FlipClass oferece planos gratuitos e pagos. Os planos pagos são cobrados mensalmente via cartão de crédito. Você pode cancelar a qualquer momento, mas não haverá reembolso proporcional do período já pago. Todos os planos pagos incluem 14 dias de teste gratuito.</p>

        <h2>5. Uso Aceitável</h2>
        <p>Você concorda em não:</p>
        <ul>
          <li>Utilizar a plataforma para fins ilegais ou não autorizados.</li>
          <li>Compartilhar conteúdo ofensivo, difamatório ou que viole direitos de terceiros.</li>
          <li>Tentar acessar dados de outros usuários sem autorização.</li>
          <li>Utilizar bots, scrapers ou ferramentas automatizadas para coletar dados da plataforma.</li>
          <li>Sobrecarregar intencionalmente os servidores da plataforma.</li>
        </ul>

        <h2>6. Propriedade Intelectual</h2>
        <p>O conteúdo criado por professores (materiais, quizzes, atividades) permanece de propriedade dos respectivos autores. O FlipClass possui licença não exclusiva para hospedar e exibir esse conteúdo dentro da plataforma. A marca, design e código da plataforma são propriedade do FlipClass.</p>

        <h2>7. Inteligência Artificial</h2>
        <p>As funcionalidades de IA (geração de quizzes e correção automática) são ferramentas de apoio. O professor é responsável por revisar e validar todo conteúdo gerado ou avaliado pela IA antes de utilizá-lo como avaliação oficial.</p>

        <h2>8. Limitação de Responsabilidade</h2>
        <p>O FlipClass é fornecido "como está". Não garantimos que o serviço será ininterrupto ou livre de erros. Não nos responsabilizamos por perdas de dados decorrentes de falhas técnicas, desde que sejam tomadas medidas razoáveis de backup e segurança.</p>

        <h2>9. Rescisão</h2>
        <p>Podemos suspender ou encerrar sua conta caso haja violação destes termos. Você pode solicitar o encerramento de sua conta a qualquer momento através do formulário de contato.</p>

        <h2>10. Alterações nos Termos</h2>
        <p>Reservamo-nos o direito de alterar estes termos. Alterações significativas serão comunicadas por email. O uso continuado após a notificação constitui aceitação dos novos termos.</p>

        <h2>11. Contato</h2>
        <p>Para dúvidas sobre estes termos, entre em contato através da página de <Link to="/contato" className="text-primary hover:underline">Contato</Link>.</p>
      </main>

      <PublicFooter />
    </div>
  );
}

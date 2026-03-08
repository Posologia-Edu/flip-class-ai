import { Link } from "react-router-dom";
import { BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/components/PublicFooter";

export default function CookiePolicy() {
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
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Política de Cookies</h1>
        <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <h2>1. O que são Cookies?</h2>
        <p>Cookies são pequenos arquivos de texto armazenados no seu navegador quando você visita um site. Eles permitem que o site lembre informações sobre sua visita, como preferências e sessão de login.</p>

        <h2>2. Cookies que Utilizamos</h2>

        <h3>Cookies Essenciais</h3>
        <p>Necessários para o funcionamento básico da plataforma. Não podem ser desativados.</p>
        <ul>
          <li><strong>Sessão de autenticação</strong> — mantém você logado enquanto navega na plataforma.</li>
          <li><strong>Token de sessão do aluno</strong> — identifica o aluno durante o acesso à sala virtual.</li>
          <li><strong>Preferências de tema</strong> — salva sua preferência de tema claro/escuro.</li>
        </ul>

        <h3>Cookies de Funcionalidade</h3>
        <p>Melhoram a experiência de uso da plataforma.</p>
        <ul>
          <li><strong>Estado do sidebar</strong> — lembra se o menu lateral estava aberto ou fechado.</li>
          <li><strong>Preferências de exibição</strong> — configurações de visualização de dados e relatórios.</li>
        </ul>

        <h3>Cookies de Análise</h3>
        <p>Ajudam a entender como os usuários interagem com a plataforma para melhorar o serviço.</p>
        <ul>
          <li><strong>Logs de atividade</strong> — registram interações com materiais e atividades para gerar relatórios de engajamento.</li>
        </ul>

        <h2>3. Cookies de Terceiros</h2>
        <p>A plataforma pode utilizar cookies de terceiros para:</p>
        <ul>
          <li><strong>Processamento de pagamentos (Stripe)</strong> — para segurança nas transações.</li>
          <li><strong>Incorporação de vídeos (YouTube)</strong> — ao reproduzir vídeos dentro da plataforma.</li>
        </ul>

        <h2>4. Como Gerenciar Cookies</h2>
        <p>Você pode gerenciar cookies através das configurações do seu navegador:</p>
        <ul>
          <li><strong>Chrome:</strong> Configurações → Privacidade e segurança → Cookies</li>
          <li><strong>Firefox:</strong> Configurações → Privacidade e segurança → Cookies e dados de sites</li>
          <li><strong>Safari:</strong> Preferências → Privacidade → Cookies e dados de sites</li>
          <li><strong>Edge:</strong> Configurações → Cookies e permissões de sites</li>
        </ul>
        <p className="text-sm bg-secondary/50 rounded-lg p-3 border border-border">
          ⚠️ <strong>Atenção:</strong> Desativar cookies essenciais pode impedir o funcionamento correto da plataforma, especialmente o login e o acesso às salas virtuais.
        </p>

        <h2>5. Armazenamento Local (Local Storage)</h2>
        <p>Além de cookies, utilizamos o armazenamento local do navegador (localStorage e sessionStorage) para salvar dados de sessão do aluno e preferências de interface. Esses dados permanecem apenas no seu dispositivo.</p>

        <h2>6. Alterações nesta Política</h2>
        <p>Esta política pode ser atualizada periodicamente. A data de última atualização será sempre indicada no topo da página.</p>

        <h2>7. Contato</h2>
        <p>Para dúvidas sobre o uso de cookies, entre em contato através da página de <Link to="/contato" className="text-primary hover:underline">Contato</Link>.</p>
      </main>

      <PublicFooter />
    </div>
  );
}

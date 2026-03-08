import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold text-foreground">FlipClass</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Plataforma de sala de aula invertida com IA para professores, educadores e pesquisadores.
            </p>
          </div>

          {/* Produto */}
          <div>
            <h4 className="font-display font-bold text-foreground mb-4">Produto</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors">
                  Criar Conta
                </Link>
              </li>
              <li>
                <Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors">
                  Entrar
                </Link>
              </li>
              <li>
                <Link to="/planos" className="text-muted-foreground hover:text-foreground transition-colors">
                  Planos
                </Link>
              </li>
              <li>
                <Link to="/funcionalidades" className="text-muted-foreground hover:text-foreground transition-colors">
                  Funcionalidades
                </Link>
              </li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h4 className="font-display font-bold text-foreground mb-4">Recursos</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="#enter-room"
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById("enter-room");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                    else window.location.href = "/#enter-room";
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sala Virtual
                </a>
              </li>
              <li>
                <Link to="/documentacao" className="text-muted-foreground hover:text-foreground transition-colors">
                  Documentação
                </Link>
              </li>
              <li>
                <Link to="/contato" className="text-muted-foreground hover:text-foreground transition-colors">
                  Contato
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display font-bold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/termos" className="text-muted-foreground hover:text-foreground transition-colors">
                  Termos de Serviço
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="text-muted-foreground hover:text-foreground transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">
                  Política de Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border mt-10 pt-6 text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} FlipClass. Todos os direitos reservados. — Desenvolvido por{" "}
            <strong className="text-foreground">Sérgio Araújo</strong>.{" "}
            <strong className="text-foreground">Posologia Produções</strong>
          </p>
        </div>
      </div>
    </footer>
  );
}

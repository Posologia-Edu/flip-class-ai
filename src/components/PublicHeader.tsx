import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Menu, X } from "lucide-react";
import FloatingAuth from "@/components/FloatingAuth";

const navItems = [
  { label: "Recursos", to: "/funcionalidades" },
  { label: "Como funciona", to: null },
  { label: "Sobre", to: "/contato" },
  { label: "Planos", to: "/planos" },
  { label: "Documentação", to: "/documentacao" },
];

function isActivePath(currentPath: string, targetPath: string) {
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export function PublicHeader() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-border/70 bg-card/90 p-2 shadow-[var(--shadow-elevated)] backdrop-blur-xl">
        <div className="flex min-h-14 items-center justify-between gap-2 px-1 sm:px-2">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded-full bg-primary/10 px-2.5 py-2 text-foreground transition-colors hover:bg-primary/15 sm:px-3"
            onClick={() => setMobileOpen(false)}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="font-display text-sm font-bold leading-tight sm:text-base">
              <span className="hidden sm:block">FlipClass</span>
              <span className="sm:hidden">Flip</span>
            </span>
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => {
              if (!item.to) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground xl:px-4"
                    title="Página em preparação"
                    aria-label="Como funciona — página em preparação"
                  >
                    {item.label}
                  </button>
                );
              }

              const active = isActivePath(location.pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors xl:px-4 ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-0.5 rounded-full bg-secondary/70 p-1 sm:flex" aria-label="Idioma">
              <span className="rounded-full bg-card px-2.5 py-1.5 text-[10px] font-semibold text-foreground shadow-sm">BR</span>
              <span className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground">US</span>
              <span className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground">ES</span>
            </div>

            <div className="hidden sm:block">
              <FloatingAuth showChevron={false} className="h-10 rounded-full border-0 bg-foreground px-5 text-background shadow-sm hover:bg-foreground/90 hover:text-background" />
            </div>

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-secondary lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-public-navigation"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav id="mobile-public-navigation" aria-label="Navegação principal" className="border-t border-border/70 px-2 pb-2 pt-2 lg:hidden">
            <div className="grid gap-1 sm:grid-cols-2">
              {navItems.map((item) =>
                item.to ? (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActivePath(location.pathname, item.to)
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground"
                    title="Página em preparação"
                    aria-label="Como funciona — página em preparação"
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/70 px-1 pt-2 sm:hidden">
              <div className="flex items-center gap-1 rounded-full bg-secondary/70 p-1" aria-label="Idioma">
                <span className="rounded-full bg-card px-2.5 py-1.5 text-[10px] font-semibold text-foreground shadow-sm">BR</span>
                <span className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground">US</span>
                <span className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground">ES</span>
              </div>
              <FloatingAuth showChevron={false} className="h-10 rounded-full border-0 bg-foreground px-5 text-background shadow-sm hover:bg-foreground/90 hover:text-background" />
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, Settings2, Shield, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import type { CookiePreferences } from "@/hooks/useCookieConsent";

interface Props {
  show: boolean;
  onAcceptAll: () => void;
  onAcceptEssential: () => void;
  onSaveCustom: (prefs: Partial<Omit<CookiePreferences, "essential" | "timestamp">>) => void;
  currentPreferences: CookiePreferences | null;
  isAdmin?: boolean;
}

export function CookieConsentBanner({ show, onAcceptAll, onAcceptEssential, onSaveCustom, currentPreferences, isAdmin = false }: Props) {
  const [showCustomize, setShowCustomize] = useState(false);
  const [functional, setFunctional] = useState(currentPreferences?.functional ?? false);
  const [analytical, setAnalytical] = useState(currentPreferences?.analytical ?? false);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
      >
        <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Main banner */}
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Cookie className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-foreground text-base mb-1">
                  Nós usamos cookies 🍪
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Utilizamos cookies para melhorar sua experiência na plataforma. Você pode personalizar suas preferências ou aceitar todos.{" "}
                  <Link to="/cookies" className="text-primary hover:underline">
                    Saiba mais
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4 ml-14">
              <Button size="sm" onClick={onAcceptAll}>
                Aceitar todos
              </Button>
              <Button size="sm" variant="outline" onClick={onAcceptEssential}>
                Apenas essenciais
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCustomize(!showCustomize)}
                className="text-muted-foreground"
              >
                <Settings2 className="w-4 h-4 mr-1" />
                Personalizar
              </Button>
            </div>
          </div>

          {/* Customize panel */}
          <AnimatePresence>
            {showCustomize && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border px-5 py-4 md:px-6 space-y-4 bg-muted/30">
                  {/* Essential */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Essenciais</p>
                        <p className="text-xs text-muted-foreground">Autenticação, sessão do aluno, tema</p>
                      </div>
                    </div>
                    <Switch checked disabled />
                  </div>

                  {/* Functional */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Settings2 className="w-4 h-4 text-accent" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Funcionalidade</p>
                        <p className="text-xs text-muted-foreground">Estado do sidebar, preferências de exibição</p>
                      </div>
                    </div>
                    <Switch checked={functional} onCheckedChange={setFunctional} />
                  </div>

                  {/* Analytical - only shown to admin */}
                  {isAdmin && (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-4 h-4 text-destructive" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Analítica</p>
                          <p className="text-xs text-muted-foreground">Rastreamento de navegação e métricas de uso</p>
                        </div>
                      </div>
                      <Switch checked={analytical} onCheckedChange={setAnalytical} />
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => onSaveCustom({ functional, analytical })}
                  >
                    Salvar preferências
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, Eye, EyeOff, Trash2, ExternalLink, Pencil, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AiApiKey {
  id: string;
  provider: string;
  api_key: string;
  updated_at: string;
}

const AI_PROVIDERS = [
  { id: "groq", name: "Groq", url: "https://console.groq.com/keys", baseUrl: "https://api.groq.com/openai/v1/chat/completions" },
  { id: "openai", name: "OpenAI", url: "https://platform.openai.com/api-keys", baseUrl: "https://api.openai.com/v1/chat/completions" },
  { id: "anthropic", name: "Anthropic", url: "https://console.anthropic.com/settings/keys", baseUrl: "https://api.anthropic.com/v1/messages" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/keys", baseUrl: "https://openrouter.ai/api/v1/chat/completions" },
  { id: "google", name: "Google AI", url: "https://aistudio.google.com/apikey", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" },
];

const maskKey = (key: string) => {
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(Math.min(key.length - 8, 12)) + key.slice(-4);
};

const AiApiKeysManager = () => {
  const [keys, setKeys] = useState<AiApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchKeys = useCallback(async () => {
    const { data, error } = await supabase.from("ai_api_keys").select("*");
    if (!error) setKeys(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const saveKey = async (provider: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast({ title: "Chave não pode ser vazia", variant: "destructive" });
      return;
    }
    setSaving(true);
    const existing = keys.find((k) => k.provider === provider);
    let error;
    if (existing) {
      ({ error } = await supabase.from("ai_api_keys").update({ api_key: trimmed, updated_at: new Date().toISOString() }).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("ai_api_keys").insert({ provider, api_key: trimmed }));
    }
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Chave salva com sucesso!" });
      setEditingProvider(null);
      setEditValue("");
      fetchKeys();
    }
    setSaving(false);
  };

  const deleteKey = async (key: AiApiKey) => {
    const { error } = await supabase.from("ai_api_keys").delete().eq("id", key.id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Chave removida!" });
      fetchKeys();
    }
  };

  const toggleVisibility = (provider: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-1">
          <Key className="w-5 h-5 text-primary" /> API Keys externas
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure as API Keys das suas LLMs favoritas. Elas serão usadas com prioridade nas funcionalidades de IA da plataforma.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Se nenhuma chave estiver configurada, os agentes nativos usarão o modelo padrão da plataforma. Se a chamada com sua chave falhar, o sistema fará fallback automático.
        </p>
      </div>

      {AI_PROVIDERS.map((provider) => {
        const savedKey = keys.find((k) => k.provider === provider.id);
        const isEditing = editingProvider === provider.id;
        const isVisible = visibleKeys.has(provider.id);

        return (
          <div key={provider.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">{provider.name}</span>
                {savedKey ? (
                  <Badge variant="default" className="bg-primary/90 hover:bg-primary text-primary-foreground text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Configurada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-xs flex items-center gap-1">
                    <Circle className="w-3 h-3" /> Não configurada
                  </Badge>
                )}
              </div>
              <a
                href={provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Adquira sua chave de API <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Cole aqui sua API Key"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 font-mono text-sm"
                  type="password"
                />
                <Button size="sm" onClick={() => saveKey(provider.id)} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingProvider(null); setEditValue(""); }}>
                  Cancelar
                </Button>
              </div>
            ) : savedKey ? (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={isVisible ? savedKey.api_key : maskKey(savedKey.api_key)}
                  className="flex-1 font-mono text-sm bg-secondary/50"
                />
                <Button size="icon" variant="ghost" onClick={() => toggleVisibility(provider.id)} title={isVisible ? "Ocultar" : "Mostrar"}>
                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingProvider(provider.id); setEditValue(savedKey.api_key); }}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => deleteKey(savedKey)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  placeholder="Cole aqui sua API Key"
                  className="flex-1 text-sm bg-secondary/30"
                />
                <Button size="sm" variant="ghost" onClick={() => { setEditingProvider(provider.id); setEditValue(""); }}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AiApiKeysManager;

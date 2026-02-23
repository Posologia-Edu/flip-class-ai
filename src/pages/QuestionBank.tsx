import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Library, Plus, Trash2, Search, Tag } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type QuestionBankItem = Tables<"question_bank">;

const QuestionBank = () => {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("question_bank")
      .select("*")
      .eq("teacher_id", user.id)
      .order("updated_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) fetchItems();
  }, [authLoading, user, fetchItems]);

  const deleteItem = async (id: string) => {
    await supabase.from("question_bank").delete().eq("id", id);
    fetchItems();
    toast({ title: "Questão removida" });
  };

  const filtered = items.filter(
    (i) =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      (i.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Library className="w-6 h-6 text-primary" />
            Banco de Questões
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie suas questões salvas para reutilizar em atividades</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título, descrição ou tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Library className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            {search ? "Nenhuma questão encontrada" : "Banco de questões vazio"}
          </h3>
          <p className="text-muted-foreground">
            {search ? "Tente outra busca." : "Suas questões salvas das atividades aparecerão aqui."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-5 hover:shadow-[var(--shadow-soft)] transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-card-foreground">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Atualizado em {new Date(item.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionBank;

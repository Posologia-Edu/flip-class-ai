import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Library, Trash2, Search, Tag, Eye, Edit2, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tables, Json } from "@/integrations/supabase/types";

type QuestionBankItem = Tables<"question_bank">;

interface QuizQuestion {
  question: string;
  type: string;
  context?: string;
  options?: string[];
  correct_answer: string;
}

interface QuizLevel {
  level: number;
  label: string;
  questions: QuizQuestion[];
}

interface QuizData {
  levels: QuizLevel[];
}

const QuestionBank = () => {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<QuestionBankItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<QuizData | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
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

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("question_bank").delete().eq("id", id);
    fetchItems();
    toast({ title: "Atividade removida" });
  };

  const openPreview = (item: QuestionBankItem) => {
    setSelectedItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description || "");
    setEditData(item.quiz_data as unknown as QuizData);
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!selectedItem || !editData) return;
    setSaving(true);
    const { error } = await supabase
      .from("question_bank")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        quiz_data: editData as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedItem.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Atividade atualizada!" });
      setEditing(false);
      fetchItems();
      setSelectedItem({ ...selectedItem, title: editTitle, description: editDescription, quiz_data: editData as unknown as Json });
    }
    setSaving(false);
  };

  const updateQuestion = (levelIdx: number, qIdx: number, field: keyof QuizQuestion, value: string) => {
    if (!editData) return;
    const newData = { ...editData };
    const levels = [...newData.levels];
    const questions = [...levels[levelIdx].questions];
    questions[qIdx] = { ...questions[qIdx], [field]: value };
    levels[levelIdx] = { ...levels[levelIdx], questions };
    newData.levels = levels;
    setEditData(newData);
  };

  const updateOption = (levelIdx: number, qIdx: number, optIdx: number, value: string) => {
    if (!editData) return;
    const newData = { ...editData };
    const levels = [...newData.levels];
    const questions = [...levels[levelIdx].questions];
    const options = [...(questions[qIdx].options || [])];
    options[optIdx] = value;
    questions[qIdx] = { ...questions[qIdx], options };
    levels[levelIdx] = { ...levels[levelIdx], questions };
    newData.levels = levels;
    setEditData(newData);
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
            Banco de Atividades
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie suas atividades salvas para reutilizar em salas</p>
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
            {search ? "Nenhuma atividade encontrada" : "Banco de atividades vazio"}
          </h3>
          <p className="text-muted-foreground">
            {search ? "Tente outra busca." : "Suas atividades salvas das salas aparecerão aqui."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const quiz = item.quiz_data as unknown as QuizData;
            const totalQ = quiz?.levels?.reduce((s, l) => s + (l.questions?.length || 0), 0) || 0;
            return (
              <div
                key={item.id}
                onClick={() => openPreview(item)}
                className="bg-card border border-border rounded-xl p-5 hover:shadow-[var(--shadow-soft)] transition-shadow group cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-card-foreground">{item.title}</h3>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {totalQ} questões
                      </span>
                    </div>
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
                    onClick={(e) => deleteItem(item.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview / Edit Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open) { setSelectedItem(null); setEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {editing ? <Edit2 className="w-5 h-5 text-primary" /> : <Eye className="w-5 h-5 text-primary" />}
              {editing ? "Editar Atividade" : "Visualizar Atividade"}
            </DialogTitle>
          </DialogHeader>

          {selectedItem && editData && (
            <div className="space-y-4 pt-2">
              {/* Title & Description */}
              {editing ? (
                <div className="space-y-3">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título" />
                  <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descrição (opcional)" />
                </div>
              ) : (
                <div>
                  <h3 className="font-display text-lg font-semibold">{editTitle}</h3>
                  {editDescription && <p className="text-sm text-muted-foreground mt-1">{editDescription}</p>}
                </div>
              )}

              {/* Questions by level */}
              {editData.levels?.map((level, li) => (
                <div key={li} className="space-y-3">
                  <h4 className="font-display font-semibold text-sm text-primary border-b border-border pb-1">
                    Nível {level.level}: {level.label}
                  </h4>
                  {level.questions?.map((q, qi) => (
                    <div key={qi} className="bg-secondary/50 rounded-lg p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-muted-foreground mt-0.5 shrink-0">Q{qi + 1}</span>
                        {editing ? (
                          <Textarea
                            value={q.question}
                            onChange={(e) => updateQuestion(li, qi, "question", e.target.value)}
                            className="text-sm min-h-[60px]"
                          />
                        ) : (
                          <p className="text-sm font-medium">{q.question}</p>
                        )}
                      </div>
                      {q.context && (
                        <p className="text-xs text-muted-foreground italic ml-6">Contexto: {q.context}</p>
                      )}
                      {q.options && q.options.length > 0 && (
                        <div className="ml-6 space-y-1">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <span className={`text-xs font-mono ${opt === q.correct_answer ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                {String.fromCharCode(65 + oi)})
                              </span>
                              {editing ? (
                                <Input
                                  value={opt}
                                  onChange={(e) => updateOption(li, qi, oi, e.target.value)}
                                  className="text-sm h-8"
                                />
                              ) : (
                                <span className={`text-sm ${opt === q.correct_answer ? "font-medium text-primary" : ""}`}>{opt}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="ml-6">
                        <span className="text-xs text-muted-foreground">Resposta correta: </span>
                        {editing ? (
                          <Input
                            value={q.correct_answer}
                            onChange={(e) => updateQuestion(li, qi, "correct_answer", e.target.value)}
                            className="text-sm h-8 mt-1"
                          />
                        ) : (
                          <span className="text-xs font-medium text-primary">{q.correct_answer}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                {editing ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                      <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={saveEdit} disabled={saving}>
                      <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-1" /> Editar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionBank;

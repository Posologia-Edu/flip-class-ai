import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Trash2, Users2, Search, Loader2 } from "lucide-react";

interface Collaborator {
  id: string;
  room_id: string;
  teacher_id: string;
  created_at: string;
  teacher_name?: string;
  teacher_email?: string;
}

interface ProfileResult {
  user_id: string;
  full_name: string | null;
}

export function RoomCollaborators({ roomId, ownerId }: { roomId: string; ownerId: string }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ user_id: string; full_name: string | null; email: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCollaborators = useCallback(async () => {
    const { data } = await supabase
      .from("room_collaborators" as any)
      .select("*")
      .eq("room_id", roomId);
    
    if (!data || (data as any[]).length === 0) {
      setCollaborators([]);
      return;
    }

    // Fetch profile names for collaborators
    const teacherIds = (data as any[]).map((c: any) => c.teacher_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", teacherIds);

    const profileMap: Record<string, string> = {};
    (profiles as ProfileResult[] || []).forEach((p) => {
      profileMap[p.user_id] = p.full_name || "Sem nome";
    });

    setCollaborators(
      (data as any[]).map((c: any) => ({
        ...c,
        teacher_name: profileMap[c.teacher_id] || "Professor",
      }))
    );
  }, [roomId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const searchTeachers = async () => {
    if (search.trim().length < 2) {
      toast({ title: "Digite pelo menos 2 caracteres", variant: "destructive" });
      return;
    }
    setSearching(true);
    
    // Search profiles by name or email
    const term = search.trim();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      .neq("user_id", ownerId)
      .eq("approval_status", "approved")
      .limit(10);

    const results: Array<{ user_id: string; full_name: string | null; email: string }> = [];
    const existingIds = new Set(collaborators.map(c => c.teacher_id));

    for (const profile of (profiles as any[] || [])) {
      if (existingIds.has(profile.user_id)) continue;
      results.push({
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email ?? "",
      });
    }

    setSearchResults(results);
    setSearching(false);

    if (results.length === 0) {
      toast({ title: "Nenhum professor encontrado", description: "Verifique o nome e tente novamente." });
    }
  };

  const addCollaborator = async (teacherId: string) => {
    setAdding(teacherId);
    const { error } = await supabase.from("room_collaborators" as any).insert({
      room_id: roomId,
      teacher_id: teacherId,
    } as any);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Professor já é colaborador desta sala", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Colaborador adicionado!" });
      setSearchResults(prev => prev.filter(r => r.user_id !== teacherId));
      fetchCollaborators();
    }
    setAdding(null);
  };

  const removeCollaborator = async (id: string) => {
    await supabase.from("room_collaborators" as any).delete().eq("id", id);
    fetchCollaborators();
    toast({ title: "Colaborador removido" });
  };

  return (
    <section className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Users2 className="w-5 h-5 text-primary" /> Professores Colaboradores
        </h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <UserPlus className="w-4 h-4 mr-1" /> Convidar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Professor Colaborador</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">
              Busque por nome entre os professores cadastrados na plataforma. O colaborador terá acesso de leitura à sala (alunos, atividades e analytics).
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Nome do professor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchTeachers()}
                className="flex-1"
              />
              <Button onClick={searchTeachers} disabled={searching} size="sm">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2 mt-3 max-h-60 overflow-y-auto">
                {searchResults.map((r) => (
                  <div key={r.user_id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium">{r.full_name || "Sem nome"}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addCollaborator(r.user_id)}
                      disabled={adding === r.user_id}
                    >
                      {adding === r.user_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><UserPlus className="w-4 h-4 mr-1" /> Adicionar</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Professores colaboradores têm acesso de leitura a esta sala.
      </p>

      {collaborators.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum colaborador adicionado.
        </p>
      ) : (
        <div className="space-y-2">
          {collaborators.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 group">
              <div className="flex items-center gap-2 text-sm">
                <Users2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{c.teacher_name || "Professor"}</span>
              </div>
              <button
                onClick={() => removeCollaborator(c.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

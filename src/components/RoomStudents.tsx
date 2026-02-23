import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Mail, Users } from "lucide-react";

interface RoomStudent {
  id: string;
  room_id: string;
  student_email: string;
  student_name: string | null;
  created_at: string;
}

export function RoomStudents({ roomId }: { roomId: string }) {
  const [students, setStudents] = useState<RoomStudent[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from("room_students")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    setStudents((data as RoomStudent[]) || []);
  }, [roomId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const addStudent = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("room_students").insert({
      room_id: roomId,
      student_email: trimmedEmail,
      student_name: name.trim() || null,
    } as any);
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Email já cadastrado nesta sala", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    } else {
      setEmail("");
      setName("");
      fetchStudents();
      toast({ title: "Aluno cadastrado!" });
    }
    setAdding(false);
  };

  const removeStudent = async (id: string) => {
    await supabase.from("room_students").delete().eq("id", id);
    fetchStudents();
    toast({ title: "Aluno removido" });
  };

  return (
    <section className="bg-card rounded-xl border border-border p-6">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-primary" /> Alunos Cadastrados
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Apenas alunos com email cadastrado poderão acessar esta sala.
      </p>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Nome do aluno"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-[200px]"
        />
        <Input
          placeholder="email@aluno.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && addStudent()}
        />
        <Button onClick={addStudent} disabled={adding} size="sm">
          <UserPlus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum aluno cadastrado. Qualquer aluno com o PIN poderá acessar.
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {students.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 group">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{s.student_name || "—"}</span>
                <span className="text-muted-foreground">{s.student_email}</span>
              </div>
              <button
                onClick={() => removeStudent(s.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">{students.length} aluno(s) cadastrado(s)</p>
        </div>
      )}
    </section>
  );
}

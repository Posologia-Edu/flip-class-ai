import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Mail, Users, Upload, Loader2 } from "lucide-react";

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
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);
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

  const addBulkStudents = async () => {
    if (!bulkText.trim()) {
      toast({ title: "Cole a lista de alunos", variant: "destructive" });
      return;
    }
    setBulkAdding(true);
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const line of lines) {
      // Support formats: "email" or "name, email" or "name; email" or "name\temail"
      const parts = line.split(/[,;\t]+/).map(p => p.trim());
      let studentEmail = "";
      let studentName = "";

      if (parts.length >= 2) {
        // Check if first part is email or name
        if (emailRegex.test(parts[0])) {
          studentEmail = parts[0].toLowerCase();
          studentName = parts[1];
        } else {
          studentName = parts[0];
          studentEmail = parts[1].toLowerCase();
        }
      } else {
        // Single value - must be email
        studentEmail = parts[0].toLowerCase();
      }

      if (!emailRegex.test(studentEmail)) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("room_students").insert({
        room_id: roomId,
        student_email: studentEmail,
        student_name: studentName || null,
      } as any);

      if (error) {
        if (error.code === "23505") skipped++;
        else errors++;
      } else {
        added++;
      }
    }

    setBulkAdding(false);
    setBulkText("");
    fetchStudents();

    const parts: string[] = [];
    if (added > 0) parts.push(`${added} adicionado(s)`);
    if (skipped > 0) parts.push(`${skipped} ignorado(s) (duplicados ou inválidos)`);
    if (errors > 0) parts.push(`${errors} erro(s)`);
    toast({
      title: "Importação concluída",
      description: parts.join(", "),
      variant: errors > 0 ? "destructive" : "default",
    });
  };

  const removeStudent = async (id: string) => {
    await supabase.from("room_students").delete().eq("id", id);
    fetchStudents();
    toast({ title: "Aluno removido" });
  };

  return (
    <section className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Alunos Cadastrados
        </h2>
        <Button
          variant={bulkMode ? "secondary" : "outline"}
          size="sm"
          onClick={() => setBulkMode(!bulkMode)}
        >
          <Upload className="w-4 h-4 mr-1" />
          {bulkMode ? "Cadastro individual" : "Cadastro em lote"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Apenas alunos com email cadastrado poderão acessar esta sala.
      </p>

      {bulkMode ? (
        <div className="space-y-3 mb-4">
          <Textarea
            placeholder={`Cole a lista de alunos (um por linha):\n\nFormatos aceitos:\nemail@aluno.com\nNome do Aluno, email@aluno.com\nNome do Aluno; email@aluno.com`}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            className="resize-y text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {bulkText.split("\n").filter(l => l.trim()).length} linha(s) detectada(s)
            </p>
            <Button onClick={addBulkStudents} disabled={bulkAdding} size="sm">
              {bulkAdding ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Importando...</>
              ) : (
                <><Upload className="w-4 h-4 mr-1" /> Importar alunos</>
              )}
            </Button>
          </div>
        </div>
      ) : (
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
      )}

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

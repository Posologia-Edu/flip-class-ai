import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, LogOut, ShieldCheck, UserCheck, UserX, Clock, ArrowLeft } from "lucide-react";

interface PendingTeacher {
  id: string;
  user_id: string;
  full_name: string | null;
  approval_status: string;
  created_at: string;
}

const AdminPanel = () => {
  const { user, isAdmin, loading } = useAuth();
  const [teachers, setTeachers] = useState<PendingTeacher[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchTeachers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, approval_status, created_at")
      .order("created_at", { ascending: false });
    setTeachers(data || []);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/dashboard");
      return;
    }
    if (!loading && isAdmin) {
      fetchTeachers();
    }
  }, [loading, isAdmin, navigate, fetchTeachers]);

  const approveTeacher = async (teacher: PendingTeacher) => {
    setProcessing(teacher.id);
    
    // Update profile status
    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
      })
      .eq("id", teacher.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // Send approval email
      try {
        await supabase.functions.invoke("send-approval-email", {
          body: { userId: teacher.user_id, approved: true },
        });
      } catch (e) {
        console.warn("Email notification failed", e);
      }
      toast({ title: "Professor aprovado!", description: `${teacher.full_name || "Professor"} agora tem acesso ao sistema.` });
      fetchTeachers();
    }
    setProcessing(null);
  };

  const rejectTeacher = async (teacher: PendingTeacher) => {
    setProcessing(teacher.id);
    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: "rejected" })
      .eq("id", teacher.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      try {
        await supabase.functions.invoke("send-approval-email", {
          body: { userId: teacher.user_id, approved: false },
        });
      } catch (e) {
        console.warn("Email notification failed", e);
      }
      toast({ title: "Cadastro rejeitado." });
      fetchTeachers();
    }
    setProcessing(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const pending = teachers.filter(t => t.approval_status === "pending");
  const approved = teachers.filter(t => t.approval_status === "approved");
  const rejected = teachers.filter(t => t.approval_status === "rejected");

  if (loading || loadingData) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">Painel Admin</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </Button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Pending */}
        <section>
          <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-accent" />
            Aguardando Aprovação ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              Nenhum cadastro pendente.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((t) => (
                <div key={t.id} className="bg-card border-2 border-accent/30 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-card-foreground">{t.full_name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">
                      Cadastrado em {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveTeacher(t)}
                      disabled={processing === t.id}
                      className="bg-level-easy hover:bg-level-easy/90 text-level-easy-foreground"
                    >
                      <UserCheck className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectTeacher(t)}
                      disabled={processing === t.id}
                      className="border-destructive text-destructive hover:bg-destructive/10"
                    >
                      <UserX className="w-4 h-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Approved */}
        <section>
          <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-4">
            <UserCheck className="w-5 h-5 text-level-easy" />
            Professores Aprovados ({approved.length})
          </h2>
          {approved.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
              Nenhum professor aprovado ainda.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data de Cadastro</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {approved.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{t.full_name || "Sem nome"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(t.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-level-easy/10 text-level-easy">
                          Aprovado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Rejected */}
        {rejected.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-4">
              <UserX className="w-5 h-5 text-destructive" />
              Rejeitados ({rejected.length})
            </h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rejected.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-muted-foreground">{t.full_name || "Sem nome"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(t.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;

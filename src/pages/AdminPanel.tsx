import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserCheck, UserX, Clock, Users, BookOpen, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PendingTeacher {
  id: string;
  user_id: string;
  full_name: string | null;
  approval_status: string;
  created_at: string;
}

interface SystemStats {
  totalTeachers: number;
  totalRooms: number;
  totalStudents: number;
  totalSessions: number;
}

const AdminPanel = () => {
  const { user, isAdmin, loading } = useAuth();
  const [teachers, setTeachers] = useState<PendingTeacher[]>([]);
  const [stats, setStats] = useState<SystemStats>({ totalTeachers: 0, totalRooms: 0, totalStudents: 0, totalSessions: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const [profilesRes, roomsRes, sessionsRes] = await Promise.all([
      supabase.from("profiles").select("id, user_id, full_name, approval_status, created_at").order("created_at", { ascending: false }),
      supabase.from("rooms").select("id", { count: "exact", head: true }),
      supabase.from("student_sessions").select("id", { count: "exact", head: true }),
    ]);
    setTeachers(profilesRes.data || []);
    const approvedCount = (profilesRes.data || []).filter((t) => t.approval_status === "approved").length;
    setStats({
      totalTeachers: approvedCount,
      totalRooms: roomsRes.count || 0,
      totalStudents: 0,
      totalSessions: sessionsRes.count || 0,
    });
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/dashboard");
      return;
    }
    if (!loading && isAdmin) fetchData();
  }, [loading, isAdmin, navigate, fetchData]);

  const approveTeacher = async (teacher: PendingTeacher) => {
    setProcessing(teacher.id);
    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id })
      .eq("id", teacher.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      try { await supabase.functions.invoke("send-approval-email", { body: { userId: teacher.user_id, approved: true } }); } catch {}
      toast({ title: "Professor aprovado!" });
      fetchData();
    }
    setProcessing(null);
  };

  const rejectTeacher = async (teacher: PendingTeacher) => {
    setProcessing(teacher.id);
    const { error } = await supabase.from("profiles").update({ approval_status: "rejected" }).eq("id", teacher.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      try { await supabase.functions.invoke("send-approval-email", { body: { userId: teacher.user_id, approved: false } }); } catch {}
      toast({ title: "Cadastro rejeitado." });
      fetchData();
    }
    setProcessing(null);
  };

  const pending = teachers.filter((t) => t.approval_status === "pending");
  const approved = teachers.filter((t) => t.approval_status === "approved");
  const rejected = teachers.filter((t) => t.approval_status === "rejected");

  if (loading || loadingData) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          Painel de Administração
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie professores, monitore o sistema e configure permissões</p>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Users className="w-4 h-4" /> Professores
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{stats.totalTeachers}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Clock className="w-4 h-4" /> Pendentes
          </div>
          <p className="font-display text-2xl font-bold text-accent">{pending.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <BookOpen className="w-4 h-4" /> Salas
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{stats.totalRooms}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <BarChart3 className="w-4 h-4" /> Sessões
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{stats.totalSessions}</p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">
            Pendentes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Aprovados ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejeitados ({rejected.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
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
                    <Button size="sm" onClick={() => approveTeacher(t)} disabled={processing === t.id}>
                      <UserCheck className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectTeacher(t)} disabled={processing === t.id} className="border-destructive text-destructive hover:bg-destructive/10">
                      <UserX className="w-4 h-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved">
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
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          Aprovado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected">
          {rejected.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
              Nenhum cadastro rejeitado.
            </div>
          ) : (
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;

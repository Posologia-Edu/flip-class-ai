import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserCheck, UserX, Clock, Users, BookOpen, BarChart3, Send, Mail, Trash2, Key } from "lucide-react";
import AiApiKeysManager from "@/components/AiApiKeysManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

interface Invite {
  id: string;
  email: string;
  status: string;
  created_at: string;
  activated_at: string | null;
}

const AdminPanel = () => {
  const { user, isAdmin, loading } = useAuth();
  const [teachers, setTeachers] = useState<PendingTeacher[]>([]);
  const [stats, setStats] = useState<SystemStats>({ totalTeachers: 0, totalRooms: 0, totalStudents: 0, totalSessions: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
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

  const fetchInvites = useCallback(async () => {
    setLoadingInvites(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-invite", {
        body: { action: "list_invites" },
      });
      if (!error && data?.invites) {
        setInvites(data.invites);
      }
    } catch {}
    setLoadingInvites(false);
  }, []);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/dashboard");
      return;
    }
    if (!loading && isAdmin) {
      fetchData();
      fetchInvites();
    }
  }, [loading, isAdmin, navigate, fetchData, fetchInvites]);

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

  const sendInvite = async () => {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    setSendingInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-invite", {
        body: { action: "invite", email: trimmed },
      });
      if (error || data?.error) {
        toast({ title: "Erro", description: data?.error || "Falha ao enviar convite", variant: "destructive" });
      } else {
        toast({ title: "Convite enviado!", description: `Email enviado para ${trimmed}` });
        setInviteEmail("");
        fetchInvites();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSendingInvite(false);
  };

  const revokeInvite = async (invite: Invite) => {
    setProcessing(invite.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-invite", {
        body: { action: "revoke_invite", invite_id: invite.id },
      });
      if (error || data?.error) {
        toast({ title: "Erro", description: data?.error || "Falha ao revogar convite", variant: "destructive" });
      } else {
        toast({ title: "Convite revogado!", description: `Convite para ${invite.email} foi removido.` });
        fetchInvites();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
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
        <p className="text-muted-foreground mt-1">Gerencie professores, convide usuários e monitore o sistema</p>
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

      <Tabs defaultValue="invites" className="space-y-6">
        <TabsList>
          <TabsTrigger value="invites">Convites</TabsTrigger>
          <TabsTrigger value="api-keys"><Key className="w-4 h-4 mr-1" /> API Keys</TabsTrigger>
          <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Aprovados ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados ({rejected.length})</TabsTrigger>
        </TabsList>

        {/* Invites Tab */}
        <TabsContent value="invites">
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-display font-semibold text-lg mb-2 flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" /> Convidar Professor
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                O convidado receberá um email com link para criar senha. Terá acesso premium gratuito permanente.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="email@professor.com"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                />
                <Button onClick={sendInvite} disabled={sendingInvite}>
                  <Mail className="w-4 h-4 mr-1" /> {sendingInvite ? "Enviando..." : "Enviar Convite"}
                </Button>
              </div>
            </div>

            {/* Invite List */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-display font-semibold text-lg mb-4">Convites Enviados</h3>
              {loadingInvites ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : invites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum convite enviado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${inv.status === "active" ? "bg-green-500 animate-pulse" : "bg-red-500 animate-pulse"}`} />
                        <div>
                          <p className="text-sm font-medium">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Enviado em {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          inv.status === "active" 
                            ? "bg-green-500/10 text-green-600" 
                            : "bg-red-500/10 text-red-500"
                        }`}>
                          {inv.status === "active" ? "Ativo" : "Pendente"}
                        </span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" disabled={processing === inv.id}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revogar convite</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja revogar o convite para <strong>{inv.email}</strong>? 
                                {inv.status !== "active" && " O usuário será removido e não poderá mais acessar o sistema."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => revokeInvite(inv)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Revogar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys">
          <div className="bg-card border border-border rounded-xl p-6">
            <AiApiKeysManager />
          </div>
        </TabsContent>

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

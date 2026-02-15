import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Video, FileText, Sparkles, Clock, Trash2, Loader2, BarChart3, Users, Eye, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;
type Material = Tables<"materials">;
type Activity = Tables<"activities">;

interface ActivityLog {
  activity_type: string;
  material_id: string | null;
  duration_seconds: number;
  session_id: string;
  created_at: string;
}

interface StudentStats {
  session: Tables<"student_sessions">;
  totalTime: number;
  materialsViewed: number;
  quizTime: number;
}

const RoomManage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [unlockAt, setUnlockAt] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessions, setSessions] = useState<Tables<"student_sessions">[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [statsTab, setStatsTab] = useState<"overview" | "details">("overview");

  const fetchData = useCallback(async () => {
    if (!roomId) return;
    const [roomRes, matRes, actRes, sessRes, logsRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).single(),
      supabase.from("materials").select("*").eq("room_id", roomId).order("created_at"),
      supabase.from("activities").select("*").eq("room_id", roomId).order("created_at"),
      supabase.from("student_sessions").select("*").eq("room_id", roomId).order("created_at"),
      supabase.from("student_activity_logs").select("activity_type, material_id, duration_seconds, session_id, created_at").eq("room_id", roomId),
    ]);
    setRoom(roomRes.data);
    setMaterials(matRes.data || []);
    setActivities(actRes.data || []);
    setSessions(sessRes.data || []);
    setActivityLogs((logsRes.data as ActivityLog[]) || []);
    if (roomRes.data?.unlock_at) {
      setUnlockAt(new Date(roomRes.data.unlock_at).toISOString().slice(0, 16));
    }
  }, [roomId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/v\/|\/watch\?v=)([^&?\s]+)/);
    return match?.[1] || null;
  };

  const addVideo = async () => {
    const ytId = extractYoutubeId(videoUrl);
    if (!ytId || !roomId) {
      toast({ title: "URL inválida", description: "Cole um link válido do YouTube.", variant: "destructive" });
      return;
    }
    setAddingVideo(true);
    const title = `Vídeo do YouTube`;
    const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

    await supabase.from("materials").insert({
      room_id: roomId,
      type: "video",
      title,
      url: videoUrl,
      thumbnail_url: thumbnail,
      content_text_for_ai: `YouTube video ID: ${ytId}. URL: ${videoUrl}`,
    });
    setVideoUrl("");
    setDialogOpen(false);
    fetchData();
    setAddingVideo(false);
  };

  const updateUnlockTime = async () => {
    if (!roomId || !unlockAt) return;
    await supabase.from("rooms").update({ unlock_at: new Date(unlockAt).toISOString() }).eq("id", roomId);
    toast({ title: "Timer atualizado!" });
    fetchData();
  };

  const deleteMaterial = async (id: string) => {
    await supabase.from("materials").delete().eq("id", id);
    fetchData();
  };

  const generateQuiz = async (material: Material) => {
    setGeneratingQuiz(material.id);
    try {
      const response = await supabase.functions.invoke("generate-quiz", {
        body: {
          materialId: material.id,
          contentText: material.content_text_for_ai || material.title,
          roomId: roomId,
        },
      });
      if (response.error) throw response.error;
      toast({ title: "Atividade gerada!", description: "A atividade foi criada com sucesso." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message || "Tente novamente.", variant: "destructive" });
    }
    setGeneratingQuiz(null);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}min ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}min`;
  };

  // Compute student stats
  const studentStats: StudentStats[] = sessions.map(session => {
    const sessionLogs = activityLogs.filter(l => l.session_id === session.id);
    const totalTime = sessionLogs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
    const materialsViewed = new Set(sessionLogs.filter(l => l.activity_type === "material_view" && l.material_id).map(l => l.material_id)).size;
    const quizTime = sessionLogs.filter(l => l.activity_type === "quiz_start" || l.activity_type === "quiz_complete")
      .reduce((s, l) => s + (l.duration_seconds || 0), 0);
    return { session, totalTime, materialsViewed, quizTime };
  });

  const totalStudents = sessions.length;
  const completedStudents = sessions.filter(s => s.completed_at).length;
  const avgScore = completedStudents > 0
    ? Math.round(sessions.filter(s => s.completed_at).reduce((s, sess) => s + (sess.score || 0), 0) / completedStudents)
    : 0;
  const totalPlatformTime = studentStats.reduce((s, st) => s + st.totalTime, 0);

  if (!room) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 bg-card flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-display text-xl font-bold">{room.title}</h1>
          <p className="text-sm text-muted-foreground">PIN: <span className="font-mono font-bold text-foreground">{room.pin_code}</span></p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* Timer Section */}
        <section className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" /> Timer de Liberação
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Defina quando as atividades serão liberadas para os alunos.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label>Data e hora de liberação</Label>
              <Input type="datetime-local" value={unlockAt} onChange={(e) => setUnlockAt(e.target.value)} />
            </div>
            <Button onClick={updateUnlockTime} disabled={!unlockAt}>Salvar</Button>
          </div>
        </section>

        {/* Materials Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Materiais</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar Vídeo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Adicionar Vídeo do YouTube</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>URL do YouTube</Label>
                    <Input placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                  </div>
                  <Button onClick={addVideo} disabled={addingVideo} className="w-full">
                    {addingVideo ? "Adicionando..." : "Adicionar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {materials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
              <Video className="w-8 h-8 mx-auto mb-2" />
              <p>Nenhum material adicionado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((mat) => (
                <div key={mat.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  {mat.thumbnail_url ? (
                    <img src={mat.thumbnail_url} alt="" className="w-24 h-16 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-24 h-16 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-card-foreground truncate">{mat.title || mat.url}</p>
                    <p className="text-xs text-muted-foreground capitalize">{mat.type}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateQuiz(mat)}
                      disabled={generatingQuiz === mat.id}
                    >
                      {generatingQuiz === mat.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-1" />
                      )}
                      Gerar Quiz
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMaterial(mat.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Activities Section */}
        {activities.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold mb-4">Atividades Geradas</h2>
            <div className="space-y-3">
              {activities.map((act, i) => (
                <div key={act.id} className="bg-card border border-border rounded-xl p-4">
                  <p className="font-medium text-card-foreground">Atividade {i + 1}</p>
                  <p className="text-xs text-muted-foreground">
                    Criada em {new Date(act.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Student Statistics Section */}
        <section>
          <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" /> Estatísticas dos Alunos
          </h2>

          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="font-display text-2xl font-bold text-foreground">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">Alunos</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Eye className="w-5 h-5 text-level-easy mx-auto mb-1" />
              <p className="font-display text-2xl font-bold text-foreground">{completedStudents}</p>
              <p className="text-xs text-muted-foreground">Concluíram</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <BarChart3 className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="font-display text-2xl font-bold text-foreground">{avgScore}</p>
              <p className="text-xs text-muted-foreground">Média Pontos</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Timer className="w-5 h-5 text-level-medium mx-auto mb-1" />
              <p className="font-display text-2xl font-bold text-foreground">{formatDuration(totalPlatformTime)}</p>
              <p className="text-xs text-muted-foreground">Tempo Total</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-4 border-b border-border">
            <button
              onClick={() => setStatsTab("overview")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${statsTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              Resumo
            </button>
            <button
              onClick={() => setStatsTab("details")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${statsTab === "details" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              Detalhado
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2" />
              <p>Nenhum aluno entrou nesta sala ainda.</p>
            </div>
          ) : statsTab === "overview" ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pontuação</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{s.student_name}</td>
                      <td className="px-4 py-3">{s.score ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.completed_at ? "bg-level-easy/10 text-level-easy" : "bg-secondary text-muted-foreground"}`}>
                          {s.completed_at ? "Concluído" : "Em andamento"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tempo na Plataforma</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Materiais Vistos</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tempo no Quiz</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pontuação</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentStats.map(({ session: s, totalTime, materialsViewed, quizTime }) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{s.student_name}</td>
                      <td className="px-4 py-3">{formatDuration(totalTime)}</td>
                      <td className="px-4 py-3">{materialsViewed} / {materials.length}</td>
                      <td className="px-4 py-3">{formatDuration(quizTime)}</td>
                      <td className="px-4 py-3">{s.score ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.completed_at ? "bg-level-easy/10 text-level-easy" : "bg-secondary text-muted-foreground"}`}>
                          {s.completed_at ? "Concluído" : "Em andamento"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default RoomManage;

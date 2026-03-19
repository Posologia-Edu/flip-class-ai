import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Video, Lock, CheckCircle2, XCircle, ChevronRight, LogOut, MessageSquare, Star, Trophy, Award, Eye, Flame, Target, TrendingUp, FileText, Headphones, Presentation, File, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import DiscussionForum from "@/components/DiscussionForum";
import NotificationCenter from "@/components/NotificationCenter";
import { PeerReviewStudent } from "@/components/PeerReview";
import { isStorageUrl } from "@/lib/storage-utils";
import type { Tables, Json } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;
type Material = Tables<"materials">;

interface QuizQuestion {
  question: string;
  type: "case_study" | "open_ended" | "multiple_choice";
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

interface ActivityWithTitle {
  title: string;
  levels: QuizLevel[];
}

// --- Progress Dashboard Component ---
interface ProgressDashboardProps {
  materials: Material[];
  activityLogs: any[];
  sessionData: Tables<"student_sessions"> | null;
  quizData: QuizData | null;
  answers: Record<string, string>;
}

interface Badge {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  earned: boolean;
  color: string;
}

const ProgressDashboard = ({ materials, activityLogs, sessionData, quizData, answers }: ProgressDashboardProps) => {
  const viewedMaterialIds = new Set(
    activityLogs
      .filter((l: any) => l.activity_type === "material_view" && l.material_id)
      .map((l: any) => l.material_id)
  );
  const materialsWatched = viewedMaterialIds.size;
  const totalMaterials = materials.length;
  const materialsProgress = totalMaterials > 0 ? Math.round((materialsWatched / totalMaterials) * 100) : 0;

  const isCompleted = !!sessionData?.completed_at;
  const totalQuestions = quizData?.levels?.reduce((s, l) => s + (l.questions?.length || 0), 0) || 0;
  const answeredQuestions = Object.keys(answers).length;
  const quizProgress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const finalQuizProgress = isCompleted ? 100 : quizProgress;

  const totalTimeSeconds = activityLogs.reduce((s: number, l: any) => s + (l.duration_seconds || 0), 0);
  const totalMinutes = Math.round(totalTimeSeconds / 60);

  let highestLevel = 0;
  if (quizData?.levels) {
    for (let li = 0; li < quizData.levels.length; li++) {
      const levelQuestions = quizData.levels[li].questions || [];
      const allAnswered = levelQuestions.every((_, qi) => answers[`${li}-${qi}`]);
      if (allAnswered) highestLevel = li + 1;
    }
  }

  const badges: Badge[] = [
    { id: "first_material", icon: <Eye className="w-6 h-6" />, label: "Explorador", description: "Acessou o primeiro material", earned: materialsWatched >= 1, color: "text-blue-500" },
    { id: "all_materials", icon: <BookOpen className="w-6 h-6" />, label: "Dedicado", description: "Acessou todos os materiais", earned: totalMaterials > 0 && materialsWatched >= totalMaterials, color: "text-purple-500" },
    { id: "first_answer", icon: <Target className="w-6 h-6" />, label: "Iniciante", description: "Respondeu a primeira questão", earned: answeredQuestions >= 1, color: "text-green-500" },
    { id: "completed", icon: <Trophy className="w-6 h-6" />, label: "Concluísta", description: "Completou toda a atividade", earned: isCompleted, color: "text-yellow-500" },
    { id: "level3", icon: <Flame className="w-6 h-6" />, label: "Mestre", description: "Alcançou o nível 3 (Complexo)", earned: highestLevel >= 3, color: "text-red-500" },
    { id: "engagement", icon: <TrendingUp className="w-6 h-6" />, label: "Engajado", description: "Passou mais de 10 min na plataforma", earned: totalMinutes >= 10, color: "text-teal-500" },
  ];

  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" /> Seu Progresso
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2"><BookOpen className="w-5 h-5 text-primary" /></div>
            <p className="font-display text-2xl font-bold text-foreground">{materialsWatched}/{totalMaterials}</p>
            <p className="text-xs text-muted-foreground">Materiais Vistos</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-level-easy/10 flex items-center justify-center mx-auto mb-2"><Target className="w-5 h-5 text-level-easy" /></div>
            <p className="font-display text-2xl font-bold text-foreground">{answeredQuestions}/{totalQuestions}</p>
            <p className="text-xs text-muted-foreground">Questões Respondidas</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-level-medium/10 flex items-center justify-center mx-auto mb-2"><Award className="w-5 h-5 text-level-medium" /></div>
            <p className="font-display text-2xl font-bold text-foreground">{highestLevel}/{quizData?.levels?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Nível Alcançado</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2"><Flame className="w-5 h-5 text-accent" /></div>
            <p className="font-display text-2xl font-bold text-foreground">{totalMinutes} min</p>
            <p className="text-xs text-muted-foreground">Tempo na Plataforma</p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wide">Barras de Progresso</h3>
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-foreground font-medium">Materiais</span>
            <span className="text-muted-foreground">{materialsProgress}%</span>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div key={`mat-${materialsProgress}`} initial={{ width: 0 }} animate={{ width: `${materialsProgress}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full bg-primary rounded-full" />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-foreground font-medium">Atividade</span>
            <span className="text-muted-foreground">{finalQuizProgress}%</span>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div key={`quiz-${finalQuizProgress}`} initial={{ width: 0 }} animate={{ width: `${finalQuizProgress}%` }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }} className={`h-full rounded-full ${finalQuizProgress >= 100 ? "bg-level-easy" : "bg-level-medium"}`} />
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Conquistas</h3>
          <span className="text-sm text-muted-foreground">{earnedCount}/{badges.length} desbloqueadas</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {badges.map((badge, i) => (
            <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.08 }}
              className={`relative border rounded-xl p-4 text-center transition-all ${badge.earned ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30 opacity-50 grayscale"}`}>
              {badge.earned && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-level-easy rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div className={`${badge.earned ? badge.color : "text-muted-foreground"} mb-2 flex justify-center`}>{badge.icon}</div>
              <p className="font-display text-sm font-bold text-foreground">{badge.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

const getMaterialIcon = (type: string) => {
  switch (type) {
    case "video": return Video;
    case "pdf": return FileText;
    case "article": return File;
    case "podcast": return Headphones;
    case "presentation": return Presentation;
    default: return FileText;
  }
};

// Helper: detect Spotify URLs
const isSpotifyUrl = (url: string) => /open\.spotify\.com/i.test(url);
const getSpotifyEmbedUrl = (url: string) => {
  // Convert open.spotify.com/episode/xxx or /show/xxx to embed
  return url.replace("open.spotify.com", "open.spotify.com/embed");
};

const StudentView = () => {
  const { roomId, sessionId } = useParams<{ roomId: string; sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [activityTitles, setActivityTitles] = useState<ActivityWithTitle[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<"materials" | "activity" | "progress" | "forum" | "peer-review">("materials");
  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [openAnswer, setOpenAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [teacherFeedbacks, setTeacherFeedbacks] = useState<Record<string, { feedback_text: string; grade: number | null }>>({});
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<Tables<"student_sessions"> | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [signedUrlMap, setSignedUrlMap] = useState<Record<string, string>>({});
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const quizStartTime = useRef<number>(0);
  const activeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewedMaterials = useRef<Set<string>>(new Set());
  const accessedMaterials = useRef<Set<string>>(new Set());
  const [viewedSet, setViewedSet] = useState<Set<string>>(new Set());

  const getSessionToken = useCallback(() => {
    return sessionId ? sessionStorage.getItem(`session_token_${sessionId}`) || "" : "";
  }, [sessionId]);

  const logActivity = useCallback(async (activityType: string, materialId?: string, durationSeconds?: number) => {
    if (!sessionId || !roomId) return;
    try {
      await supabase.functions.invoke("student-session", {
        body: {
          action: "log_activity", sessionId, roomId, token: getSessionToken(),
          data: { activity_type: activityType, material_id: materialId || null, duration_seconds: durationSeconds || 0 },
        },
      });
      setActivityLogs(prev => [...prev, {
        activity_type: activityType,
        material_id: materialId || null,
        duration_seconds: durationSeconds || 0,
        session_id: sessionId,
        created_at: new Date().toISOString(),
      }]);
    } catch (e) {
      console.warn("Activity log failed", e);
    }
  }, [sessionId, roomId, getSessionToken]);

  useEffect(() => {
    if (!sessionId || !roomId) return;
    activeTimer.current = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      logActivity("page_active", tab === "materials" ? activeMaterialId || undefined : undefined, 30);
    }, 30000);
    return () => {
      if (activeTimer.current) clearInterval(activeTimer.current);
    };
  }, [sessionId, roomId, tab, activeMaterialId, logActivity]);

  // Track material interaction on click/expand — sets activeMaterialId for page_active attribution
  const handleMaterialInteraction = useCallback((materialId: string) => {
    setActiveMaterialId(materialId);
    if (!accessedMaterials.current.has(materialId)) {
      accessedMaterials.current.add(materialId);
      logActivity("material_open", materialId, 0);
    }
  }, [logActivity]);

  // Reset active material when leaving materials tab
  useEffect(() => {
    if (tab !== "materials") {
      setActiveMaterialId(null);
    }
  }, [tab]);

  const isValidUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const fetchData = useCallback(async () => {
    if (!roomId || !isValidUuid(roomId)) return;
    if (sessionId && !isValidUuid(sessionId)) return;
    const [roomRes, matRes, actRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).single(),
      supabase.from("materials").select("*").eq("room_id", roomId).order("created_at"),
      supabase.from("activities").select("*").eq("room_id", roomId).order("created_at"),
    ]);
    setRoom(roomRes.data);
    setMaterials(matRes.data || []);

    // Merge all published activities' quiz data into one
    if (actRes.data && actRes.data.length > 0) {
      const allLevels: QuizLevel[] = [];
      const titles: ActivityWithTitle[] = [];
      for (const act of actRes.data) {
        const qd = act.quiz_data as unknown as QuizData;
        if (qd?.levels) {
          const actTitle = (act as any).title || "Atividade";
          titles.push({ title: actTitle, levels: qd.levels });
          allLevels.push(...qd.levels);
        }
      }
      setQuizData({ levels: allLevels });
      setActivityTitles(titles);
    }

    if (sessionId) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const token = getSessionToken();
      const res = await fetch(`${supabaseUrl}/functions/v1/student-session?sessionId=${sessionId}&token=${encodeURIComponent(token)}`, {
        headers: { "apikey": supabaseKey, "Content-Type": "application/json" },
      });
      const sessionResult = await res.json();
      if (sessionResult && !sessionResult.error) {
        setActivityLogs(sessionResult.activityLogs || []);
        // Populate viewedMaterials ref from existing logs
        const viewedIds = (sessionResult.activityLogs || [])
          .filter((l: any) => l.activity_type === "material_view" && l.material_id)
          .map((l: any) => l.material_id);
        viewedIds.forEach((id: string) => viewedMaterials.current.add(id));
        setViewedSet(new Set(viewedIds));

        if (sessionResult.session) {
          setSessionData(sessionResult.session);
          if (sessionResult.session.completed_at) {
            setSubmitted(true);
            if (sessionResult.session.answers) {
              setAnswers(sessionResult.session.answers as Record<string, string>);
            }
          }
        }
        if (sessionResult.teacherFeedbacks) {
          const fbMap: Record<string, { feedback_text: string; grade: number | null }> = {};
          for (const fb of sessionResult.teacherFeedbacks) {
            fbMap[fb.question_key] = { feedback_text: fb.feedback_text, grade: fb.grade };
          }
          setTeacherFeedbacks(fbMap);
        }
      }
    }
    if (roomRes.data?.unlock_at) {
      setUnlocked(new Date(roomRes.data.unlock_at) <= new Date());
    } else {
      setUnlocked(true);
    }
  }, [roomId, sessionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Resolve private storage URLs to signed URLs for student access
  useEffect(() => {
    if (!sessionId || materials.length === 0) return;
    const storageUrls = materials
      .filter(m => m.url && isStorageUrl(m.url))
      .map(m => m.url!);
    if (storageUrls.length === 0) return;

    const resolveUrls = async () => {
      try {
        const { data } = await supabase.functions.invoke("student-session", {
          body: { action: "get_signed_urls", sessionId, token: getSessionToken(), data: { urls: storageUrls } },
        });
        if (data?.signedUrls) {
          setSignedUrlMap(data.signedUrls);
        }
      } catch (e) {
        console.warn("Failed to resolve signed URLs", e);
      }
    };
    resolveUrls();
  }, [sessionId, materials, getSessionToken]);

  /** Get the resolved URL for a material (signed URL if storage, original otherwise) */
  const resolveUrl = useCallback((url: string | null): string | null => {
    if (!url) return null;
    return signedUrlMap[url] || url;
  }, [signedUrlMap]);

  // Fetch only teacher feedbacks (lightweight)
  const fetchFeedbacks = useCallback(async () => {
    if (!sessionId) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const token = getSessionToken();
      const res = await fetch(`${supabaseUrl}/functions/v1/student-session?sessionId=${sessionId}&token=${encodeURIComponent(token)}`, {
        headers: { "apikey": supabaseKey, "Content-Type": "application/json" },
      });
      const result = await res.json();
      if (result?.teacherFeedbacks) {
        const fbMap: Record<string, { feedback_text: string; grade: number | null }> = {};
        for (const fb of result.teacherFeedbacks) {
          fbMap[fb.question_key] = { feedback_text: fb.feedback_text, grade: fb.grade };
        }
        setTeacherFeedbacks(fbMap);
      }
    } catch {
      // ignore
    }
  }, [sessionId]);

  // Real-time subscriptions + polling fallback for feedback
  useEffect(() => {
    if (!roomId || !sessionId) return;

    const channel = supabase
      .channel(`student-view:${roomId}:${sessionId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "materials",
        filter: `room_id=eq.${roomId}`,
      }, fetchData)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "activities",
        filter: `room_id=eq.${roomId}`,
      }, fetchData)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
      }, fetchData)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "teacher_feedback",
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        fetchFeedbacks();
        setShowFeedback(true);
      })
      .subscribe();

    // Polling fallback for feedback (every 15s) since student may not have auth for realtime
    const feedbackPoll = setInterval(fetchFeedbacks, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(feedbackPoll);
    };
  }, [roomId, sessionId, fetchData, fetchFeedbacks]);

  useEffect(() => {
    if (!room?.unlock_at || unlocked) return;
    const interval = setInterval(() => {
      const diff = new Date(room.unlock_at!).getTime() - Date.now();
      if (diff <= 0) { setUnlocked(true); setTimeLeft(""); clearInterval(interval); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [room, unlocked]);

  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/v\/|\/watch\?v=)([^&?\s]+)/);
    return match?.[1] || null;
  };

  const levelStyles = [
    { border: "border-level-easy", bg: "bg-level-easy/10", text: "text-level-easy", label: "Nível 1 — Aplicação Básica" },
    { border: "border-level-medium", bg: "bg-level-medium/10", text: "text-level-medium", label: "Nível 2 — Caso Intermediário" },
    { border: "border-level-hard", bg: "bg-level-hard/10", text: "text-level-hard", label: "Nível 3 — Caso Complexo" },
  ];

  const levels = quizData?.levels || [];
  const currentLevelData = levels[currentLevel];
  const currentQ = currentLevelData?.questions?.[currentQuestion];
  const qKey = `${currentLevel}-${currentQuestion}`;

  // Determine which activity title should be shown for the current level
  const getActivityTitleForLevel = (levelIndex: number): string | null => {
    let accumulated = 0;
    for (const act of activityTitles) {
      const start = accumulated;
      accumulated += act.levels.length;
      if (levelIndex >= start && levelIndex < accumulated) {
        if (levelIndex === start) return act.title;
        return null;
      }
    }
    return null;
  };

  const handleSubmitAnswer = () => {
    setShowResult(false);
    setOpenAnswer("");
    if (currentQuestion < (currentLevelData?.questions?.length || 0) - 1) {
      setCurrentQuestion((q) => q + 1);
    } else if (currentLevel < levels.length - 1) {
      setCurrentLevel((l) => l + 1);
      setCurrentQuestion(0);
    } else {
      submitQuiz();
    }
  };

  const handleStartQuiz = () => {
    setTab("activity");
    quizStartTime.current = Date.now();
    logActivity("quiz_start");
  };

  const handleViewMaterial = (materialId: string) => {
    if (!viewedMaterials.current.has(materialId)) {
      viewedMaterials.current.add(materialId);
      setViewedSet(prev => new Set(prev).add(materialId));
      logActivity("material_view", materialId, 1);
      toast({ title: "Material marcado como visto!" });
    }
  };

  const submitQuiz = async () => {
    setSubmitted(true);
    const quizDuration = Math.round((Date.now() - quizStartTime.current) / 1000);
    logActivity("quiz_complete", undefined, quizDuration);

    // Update sessionData locally so progress bar reflects completion immediately
    setSessionData(prev => prev ? { ...prev, completed_at: new Date().toISOString(), score: Object.keys(answers).length, answers: answers as any } : prev);

    if (sessionId) {
      await supabase.functions.invoke("student-session", {
        body: {
          action: "submit", sessionId, token: getSessionToken(),
          data: { score: Object.keys(answers).length, answers },
        },
      });
    }
    toast({ title: "Atividade concluída!", description: "Suas respostas foram enviadas ao professor para avaliação." });
  };

  const ViewedButton = ({ materialId }: { materialId: string }) => {
    const isViewed = viewedSet.has(materialId);
    return (
      <Button size="sm" variant={isViewed ? "default" : "ghost"} onClick={(e) => { e.stopPropagation(); handleViewMaterial(materialId); }} disabled={isViewed} className={isViewed ? "bg-level-easy text-white hover:bg-level-easy" : ""}>
        {isViewed ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
        {isViewed ? "Visto" : "Marcar como visto"}
      </Button>
    );
  };

  const renderMaterialCard = (mat: Material) => {
    const ytId = mat.url ? extractYoutubeId(mat.url) : null;
    const MatIcon = getMaterialIcon(mat.type);
    const matUrl = resolveUrl(mat.url);

    if (mat.type === "video" && ytId) {
      return (
        <div key={mat.id} data-material-id={mat.id} onClick={() => handleMaterialInteraction(mat.id)} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-medium text-card-foreground">{mat.title || "Vídeo"}</h3>
            <ViewedButton materialId={mat.id} />
          </div>
        </div>
      );
    }

    if (mat.type === "pdf" || mat.type === "presentation") {
      return (
        <div key={mat.id} data-material-id={mat.id} onClick={() => handleMaterialInteraction(mat.id)} className="bg-card border border-border rounded-xl overflow-hidden">
          {matUrl ? (
            <>
              <div className="aspect-[4/3]"><iframe src={matUrl} className="w-full h-full" title={mat.title} /></div>
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2"><MatIcon className="w-5 h-5 text-muted-foreground" /><h3 className="font-medium text-card-foreground">{mat.title || "Material"}</h3></div>
                <div className="flex items-center gap-2">
                  <a href={matUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Abrir</a>
                  <ViewedButton materialId={mat.id} />
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3"><MatIcon className="w-8 h-8 text-muted-foreground" /><h3 className="font-medium text-card-foreground">{mat.title || "Material"}</h3></div>
              <ViewedButton materialId={mat.id} />
            </div>
          )}
        </div>
      );
    }

    if (mat.type === "article") {
      const isExpanded = expandedArticle === mat.id;
      const content = mat.content_text_for_ai || "";
      const preview = content.length > 300 ? content.slice(0, 300) + "..." : content;
      return (
        <div key={mat.id} data-material-id={mat.id} onClick={() => handleMaterialInteraction(mat.id)} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><File className="w-5 h-5 text-muted-foreground" /><h3 className="font-medium text-card-foreground">{mat.title || "Artigo"}</h3></div>
              <ViewedButton materialId={mat.id} />
            </div>
            {content && (
              <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {isExpanded ? content : preview}
                {content.length > 300 && (
                  <button onClick={() => setExpandedArticle(isExpanded ? null : mat.id)} className="text-primary text-sm font-medium ml-1 hover:underline">
                    {isExpanded ? "Ver menos" : "Ler mais"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (mat.type === "podcast") {
      const url = matUrl || "";
      const spotify = isSpotifyUrl(url);

      return (
        <div key={mat.id} data-material-id={mat.id} onClick={() => handleMaterialInteraction(mat.id)} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-medium text-card-foreground">{mat.title || "Podcast"}</h3>
              </div>
              <ViewedButton materialId={mat.id} />
            </div>
            {url && spotify ? (
              <div className="space-y-3">
                <iframe
                  src={getSpotifyEmbedUrl(url)}
                  width="100%"
                  height="152"
                  frameBorder="0"
                  allow="encrypted-media"
                  className="rounded-lg"
                />
              </div>
            ) : url ? (
              <div className="space-y-3">
                <div className="bg-secondary rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Headphones className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{mat.title || "Podcast"}</p>
                      <p className="text-xs text-muted-foreground">Player não disponível para este host</p>
                    </div>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> Ouvir
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    // Generic fallback
    return (
      <div key={mat.id} data-material-id={mat.id} onClick={() => handleMaterialInteraction(mat.id)} className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MatIcon className="w-8 h-8 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-card-foreground">{mat.title || "Material"}</h3>
              {matUrl && (
                <a href={matUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1 mt-1">
                  <ExternalLink className="w-4 h-4" /> Abrir
                </a>
              )}
            </div>
          </div>
          <ViewedButton materialId={mat.id} />
        </div>
      </div>
    );
  };

  if (!room) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;

  const activityTitle = getActivityTitleForLevel(currentLevel);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold">{room.title}</h1>
            <p className="text-xs text-muted-foreground">Sala de Aula Invertida</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter sessionId={sessionId} roomId={roomId} />
          <Button variant="outline" size="sm" onClick={() => navigate("/")}><LogOut className="w-4 h-4 mr-2" /> Sair</Button>
        </div>
      </header>

      <div className="border-b border-border bg-card px-6">
        <div className="flex gap-6 overflow-x-auto">
          <button onClick={() => setTab("materials")} className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "materials" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <BookOpen className="w-4 h-4 inline mr-1.5" /> Materiais
          </button>
          <button onClick={() => unlocked && quizData && handleStartQuiz()} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${!unlocked || !quizData ? "opacity-50 cursor-not-allowed border-transparent text-muted-foreground" : tab === "activity" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {!unlocked && <Lock className="w-3.5 h-3.5" />} Atividade
          </button>
          <button onClick={() => setTab("progress")} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${tab === "progress" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Trophy className="w-4 h-4" /> Progresso
          </button>
          <button onClick={() => setTab("forum")} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${tab === "forum" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <MessageSquare className="w-4 h-4" /> Fórum
          </button>
          <button onClick={() => setTab("peer-review")} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${tab === "peer-review" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Users className="w-4 h-4" /> Avaliação por Pares
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {tab === "materials" ? (
          <div className="space-y-6">
            {!unlocked && timeLeft && (
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-center">
                <Lock className="w-5 h-5 text-accent mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Atividade será liberada em</p>
                <p className="font-display text-3xl font-bold text-accent mt-1">{timeLeft}</p>
              </div>
            )}
            {materials.map((mat) => renderMaterialCard(mat))}
            {materials.length === 0 && (
              <div className="text-center py-16 text-muted-foreground"><BookOpen className="w-8 h-8 mx-auto mb-2" /><p>Nenhum material disponível ainda.</p></div>
            )}
          </div>
        ) : tab === "progress" ? (
          <ProgressDashboard materials={materials} activityLogs={activityLogs} sessionData={sessionData} quizData={quizData} answers={answers} />
        ) : tab === "forum" ? (
          <DiscussionForum roomId={roomId!} studentName={sessionData?.student_name} studentEmail={sessionData?.student_email || undefined} />
        ) : tab === "peer-review" ? (
          <PeerReviewStudent sessionId={sessionId!} roomId={roomId!} quizData={quizData} studentName={sessionData?.student_name || "Aluno"} />
        ) : submitted ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <CheckCircle2 className="w-16 h-16 text-level-easy mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold mb-2">Atividade Concluída!</h2>
            <p className="text-muted-foreground mb-6">Suas respostas foram enviadas ao professor para avaliação.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setShowFeedback(!showFeedback)}>
                <MessageSquare className="w-4 h-4 mr-2" /> {showFeedback ? "Ocultar Feedback" : "Ver Feedback"}
              </Button>
              <Button onClick={() => navigate("/")}>Voltar para Início</Button>
            </div>

            {showFeedback && (
              <div className="mt-8 text-left max-w-2xl mx-auto space-y-4">
                {quizData?.levels?.map((level, li) => (
                  <div key={li}>
                    <p className="font-semibold text-sm text-primary mb-2">{level.label}</p>
                    {level.questions?.map((q, qi) => {
                      const key = `${li}-${qi}`;
                      const fb = teacherFeedbacks[key];
                      return (
                        <div key={qi} className="mb-3 bg-card border border-border rounded-lg p-4">
                          <p className="font-medium text-sm text-foreground mb-2">{qi + 1}. {q.question}</p>
                          <div className="bg-secondary rounded-lg p-3 mb-2">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Sua resposta:</p>
                            <p className="text-sm text-foreground">{answers[key] || <span className="italic text-muted-foreground">Não respondida</span>}</p>
                          </div>
                          {fb ? (
                            <div className="border-t border-border pt-3 mt-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                                <p className="text-xs font-semibold text-primary">Feedback do Professor</p>
                                {fb.grade !== null && fb.grade !== undefined && (
                                  <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                                    <Star className="w-3 h-3" /> {fb.grade}/10
                                  </span>
                                )}
                              </div>
                              {fb.feedback_text && <p className="text-sm text-foreground bg-secondary rounded-lg p-3">{fb.feedback_text}</p>}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic mt-2">Aguardando avaliação do professor</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {Object.keys(teacherFeedbacks).length === 0 && (
                  <div className="text-center py-6 text-muted-foreground"><MessageSquare className="w-8 h-8 mx-auto mb-2" /><p>Nenhum feedback disponível ainda. Aguarde a avaliação do professor.</p></div>
                )}
              </div>
            )}
          </motion.div>
        ) : currentQ ? (
          <AnimatePresence mode="wait">
            <motion.div key={qKey} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* Show activity title when starting a new activity */}
              {activityTitle && (
                <div className="mb-4 bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <h2 className="font-display text-lg font-bold text-primary">{activityTitle}</h2>
                </div>
              )}

              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 ${levelStyles[currentLevel % levelStyles.length]?.bg} ${levelStyles[currentLevel % levelStyles.length]?.text}`}>
                {levelStyles[currentLevel % levelStyles.length]?.label || currentLevelData?.label}
              </div>

              <div className={`bg-card border-2 ${levelStyles[currentLevel % levelStyles.length]?.border} rounded-xl p-6`}>
                <p className="text-xs text-muted-foreground mb-2">Questão {currentQuestion + 1} de {currentLevelData.questions.length}</p>

                {currentQ.context && (
                  <div className="bg-secondary rounded-lg p-4 mb-4 text-sm text-foreground leading-relaxed">
                    <p className="font-semibold text-xs text-muted-foreground uppercase mb-2">Contexto do Caso</p>
                    {currentQ.context}
                  </div>
                )}

                <h3 className="font-display text-xl font-semibold text-card-foreground mb-6">{currentQ.question}</h3>

                <div className="space-y-4">
                  {currentQ.type === "multiple_choice" && currentQ.options ? (
                    <div className="space-y-3">
                      {currentQ.options.map((option, optIdx) => {
                        const isSelected = answers[qKey] === option;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => {
                              setOpenAnswer(option);
                              setAnswers((prev) => ({ ...prev, [qKey]: option }));
                            }}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-secondary text-foreground hover:border-primary/50"
                            }`}
                          >
                            <span className="text-sm">{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      className="w-full p-4 bg-secondary rounded-lg border-none text-foreground resize-none min-h-[150px] focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Desenvolva sua resposta com base no caso apresentado..."
                      value={answers[qKey] || openAnswer}
                      onChange={(e) => { setOpenAnswer(e.target.value); setAnswers((prev) => ({ ...prev, [qKey]: e.target.value })); }}
                    />
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={handleSubmitAnswer} disabled={!answers[qKey]}>
                    {currentLevel === levels.length - 1 && currentQuestion === currentLevelData.questions.length - 1 ? "Finalizar" : "Enviar Resposta"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2" />
            <p>Nenhuma atividade disponível ainda.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentView;

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Video, Lock, CheckCircle2, XCircle, ChevronRight, LogOut, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables, Json } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;
type Material = Tables<"materials">;

interface QuizQuestion {
  question: string;
  type: "case_study" | "open_ended";
  context?: string;
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

const StudentView = () => {
  const { roomId, sessionId } = useParams<{ roomId: string; sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<"materials" | "activity">("materials");
  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [openAnswer, setOpenAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [teacherFeedbacks, setTeacherFeedbacks] = useState<Record<string, { feedback_text: string; grade: number | null }>>({});
  const quizStartTime = useRef<number>(0);
  const activeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const logActivity = useCallback(async (activityType: string, materialId?: string, durationSeconds?: number) => {
    if (!sessionId || !roomId) return;
    try {
      await supabase.from("student_activity_logs").insert({
        session_id: sessionId,
        room_id: roomId,
        activity_type: activityType,
        material_id: materialId || null,
        duration_seconds: durationSeconds || 0,
      });
    } catch (e) {
      console.warn("Activity log failed", e);
    }
  }, [sessionId, roomId]);

  useEffect(() => {
    if (!sessionId || !roomId) return;
    activeTimer.current = setInterval(() => {
      logActivity("page_active", undefined, 30);
    }, 30000);
    return () => {
      if (activeTimer.current) clearInterval(activeTimer.current);
    };
  }, [sessionId, roomId, logActivity]);

  const fetchData = useCallback(async () => {
    if (!roomId) return;
    const [roomRes, matRes, actRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).single(),
      supabase.from("materials").select("*").eq("room_id", roomId).order("created_at"),
      supabase.from("activities").select("*").eq("room_id", roomId).order("created_at").limit(1),
    ]);
    setRoom(roomRes.data);
    setMaterials(matRes.data || []);
    if (actRes.data?.[0]) {
      setQuizData(actRes.data[0].quiz_data as unknown as QuizData);
    }
    if (roomRes.data?.unlock_at) {
      setUnlocked(new Date(roomRes.data.unlock_at) <= new Date());
    } else {
      setUnlocked(true);
    }
  }, [roomId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!room?.unlock_at || unlocked) return;
    const interval = setInterval(() => {
      const diff = new Date(room.unlock_at!).getTime() - Date.now();
      if (diff <= 0) {
        setUnlocked(true);
        setTimeLeft("");
        clearInterval(interval);
        return;
      }
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

  const checkAnswer = () => {
    setShowResult(true);
  };

  const nextQuestion = () => {
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
    logActivity("material_view", materialId);
  };

  const submitQuiz = async () => {
    setSubmitted(true);
    const quizDuration = Math.round((Date.now() - quizStartTime.current) / 1000);
    logActivity("quiz_complete", undefined, quizDuration);

    if (sessionId) {
      await supabase.from("student_sessions").update({
        score: Object.keys(answers).length,
        answers: answers as unknown as Json,
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }
    toast({ title: "Atividade concluída!", description: "Suas respostas foram enviadas ao professor para avaliação." });
  };

  if (!room) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;

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
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </Button>
      </header>

      <div className="border-b border-border bg-card px-6">
        <div className="flex gap-6">
          <button
            onClick={() => setTab("materials")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === "materials" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Video className="w-4 h-4 inline mr-1.5" /> Materiais
          </button>
          <button
            onClick={() => unlocked && quizData && handleStartQuiz()}
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              !unlocked || !quizData ? "opacity-50 cursor-not-allowed border-transparent text-muted-foreground" :
              tab === "activity" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {!unlocked && <Lock className="w-3.5 h-3.5" />}
            Atividade
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

            {materials.map((mat) => {
              const ytId = mat.url ? extractYoutubeId(mat.url) : null;
              return (
                <div key={mat.id} className="bg-card border border-border rounded-xl overflow-hidden" onClick={() => handleViewMaterial(mat.id)}>
                  {ytId && (
                    <div className="aspect-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-medium text-card-foreground">{mat.title || "Material"}</h3>
                  </div>
                </div>
              );
            })}

            {materials.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Video className="w-8 h-8 mx-auto mb-2" />
                <p>Nenhum material disponível ainda.</p>
              </div>
            )}
          </div>
        ) : submitted ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <CheckCircle2 className="w-16 h-16 text-level-easy mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold mb-2">Atividade Concluída!</h2>
            <p className="text-muted-foreground mb-6">Suas respostas foram enviadas ao professor para avaliação.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={async () => {
                if (!sessionId) return;
                const { data } = await supabase
                  .from("teacher_feedback" as any)
                  .select("*")
                  .eq("session_id", sessionId);
                if (data) {
                  const fbMap: Record<string, { feedback_text: string; grade: number | null }> = {};
                  (data as any[]).forEach((fb: any) => {
                    fbMap[fb.question_key] = { feedback_text: fb.feedback_text || "", grade: fb.grade };
                  });
                  setTeacherFeedbacks(fbMap);
                }
                setShowFeedback(true);
              }}>
                <MessageSquare className="w-4 h-4 mr-2" /> Ver Feedback
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
                              {fb.feedback_text && (
                                <p className="text-sm text-foreground bg-secondary rounded-lg p-3">{fb.feedback_text}</p>
                              )}
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
                  <div className="text-center py-6 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                    <p>Nenhum feedback disponível ainda. Aguarde a avaliação do professor.</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : currentQ ? (
          <AnimatePresence mode="wait">
            <motion.div key={qKey} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 ${levelStyles[currentLevel]?.bg} ${levelStyles[currentLevel]?.text}`}>
                {levelStyles[currentLevel]?.label}
              </div>

              <div className={`bg-card border-2 ${levelStyles[currentLevel]?.border} rounded-xl p-6`}>
                <p className="text-xs text-muted-foreground mb-2">
                  Questão {currentQuestion + 1} de {currentLevelData.questions.length}
                </p>

                {currentQ.context && (
                  <div className="bg-secondary rounded-lg p-4 mb-4 text-sm text-foreground leading-relaxed">
                    <p className="font-semibold text-xs text-muted-foreground uppercase mb-2">Contexto do Caso</p>
                    {currentQ.context}
                  </div>
                )}

                <h3 className="font-display text-xl font-semibold text-card-foreground mb-6">
                  {currentQ.question}
                </h3>

                <div className="space-y-4">
                  <textarea
                    className="w-full p-4 bg-secondary rounded-lg border-none text-foreground resize-none min-h-[150px] focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Desenvolva sua resposta com base no caso apresentado..."
                    value={answers[qKey] || openAnswer}
                    onChange={(e) => {
                      setOpenAnswer(e.target.value);
                      setAnswers((prev) => ({ ...prev, [qKey]: e.target.value }));
                    }}
                    disabled={showResult}
                  />
                </div>

                <div className="mt-6 flex justify-end">
                  {!showResult ? (
                    <Button onClick={checkAnswer} disabled={!answers[qKey]}>
                      Enviar Resposta
                    </Button>
                  ) : (
                    <Button onClick={nextQuestion}>
                      {currentLevel === levels.length - 1 && currentQuestion === currentLevelData.questions.length - 1
                        ? "Finalizar"
                        : "Próxima"}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhuma atividade disponível ainda.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentView;

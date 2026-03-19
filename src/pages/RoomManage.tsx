import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Video, FileText, Sparkles, Clock, Trash2, Loader2, BarChart3, Users, Eye, Timer, ChevronDown, ChevronUp, MessageSquare, FileEdit, Check, Save, BookmarkPlus, Library, Download, TrendingUp, Upload, Link, Headphones, Presentation, File, Bot, ThumbsUp, ThumbsDown, Lightbulb, Lock, EyeOff, PenLine } from "lucide-react";
import AnalyticsReport from "@/components/AnalyticsReport";
import { RoomStudents } from "@/components/RoomStudents";
import { RoomCollaborators } from "@/components/RoomCollaborators";
import DiscussionForum from "@/components/DiscussionForum";
import { PeerReviewTeacher } from "@/components/PeerReview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables, Json } from "@/integrations/supabase/types";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { useAuth } from "@/contexts/AuthContext";

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

interface QuizQuestion {
  question: string;
  type: string;
  context?: string;
  options?: string[];
  correct_answer: string;
  points?: number;
}

type ActivityGenerationType = "quiz" | "case_study";

interface QuizLevel {
  level: number;
  label: string;
  questions: QuizQuestion[];
}

interface QuizData {
  levels: QuizLevel[];
}

const MATERIAL_TYPES = [
  { value: "video", label: "Vídeo do YouTube", icon: Video },
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "article", label: "Artigo / Texto", icon: File },
  { value: "podcast", label: "Podcast / Áudio", icon: Headphones },
  { value: "presentation", label: "Apresentação", icon: Presentation },
];

const getMaterialIcon = (type: string) => {
  const found = MATERIAL_TYPES.find(t => t.value === type);
  return found ? found.icon : FileText;
};

const getMaterialLabel = (type: string) => {
  const found = MATERIAL_TYPES.find(t => t.value === type);
  return found ? found.label : type;
};

const LEVEL_TEMPLATES = [
  { level: 1, label: "Nível 1 — Aplicação Básica" },
  { level: 2, label: "Nível 2 — Análise Intermediária" },
  { level: 3, label: "Nível 3 — Síntese Complexa" },
];

const RoomManage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canUploadFile, canGenerateQuiz, canUseAiCorrection, canUsePeerReview, loading: gateLoading, aiUsage, limits } = useFeatureGate();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [unlockAt, setUnlockAt] = useState("");
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessions, setSessions] = useState<Tables<"student_sessions">[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [statsTab, setStatsTab] = useState<"overview" | "details" | "answers" | "reports">("overview");
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");
  const [selectedMaterialForQuiz, setSelectedMaterialForQuiz] = useState<Material | null>(null);
  const [activityTypeDialogOpen, setActivityTypeDialogOpen] = useState(false);
  const [pendingMaterialForType, setPendingMaterialForType] = useState<Material | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityGenerationType>("case_study");
  const [feedbacks, setFeedbacks] = useState<Record<string, { feedback_text: string; grade: number | null; saved: boolean }>>({});
  const [savingFeedback, setSavingFeedback] = useState<string | null>(null);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankItems, setBankItems] = useState<any[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [savingToBank, setSavingToBank] = useState<string | null>(null);
  const [bankTitle, setBankTitle] = useState("");
  const [saveBankDialogOpen, setSaveBankDialogOpen] = useState(false);
  const [activityToSave, setActivityToSave] = useState<Activity | null>(null);
  const [aiGrading, setAiGrading] = useState<string | null>(null);
  const [aiGradingAll, setAiGradingAll] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, { grade: number; feedback: string; strengths: string[]; weaknesses: string[]; suggestion: string }>>({});

  // New material form state
  const [newMaterialType, setNewMaterialType] = useState("video");
  const [newMaterialTitle, setNewMaterialTitle] = useState("");
  const [newMaterialUrl, setNewMaterialUrl] = useState("");
  const [newMaterialContent, setNewMaterialContent] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);

  // Manual activity creation state
  const [manualActivityDialogOpen, setManualActivityDialogOpen] = useState(false);
  const [manualActivityTitle, setManualActivityTitle] = useState("");
  const [manualLevels, setManualLevels] = useState<QuizLevel[]>(
    LEVEL_TEMPLATES.map(t => ({ ...t, questions: [{ question: "", type: "case_study", context: "", correct_answer: "" }] }))
  );
  const [savingManualActivity, setSavingManualActivity] = useState(false);

  const isOwner = useMemo(() => !!(user && room && room.teacher_id === user.id), [user, room]);

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

    const sessionIds = (sessRes.data || []).map(s => s.id);
    if (sessionIds.length > 0) {
      const { data: fbData } = await supabase
        .from("teacher_feedback" as any)
        .select("*")
        .in("session_id", sessionIds);
      if (fbData) {
        const fbMap: Record<string, { feedback_text: string; grade: number | null; saved: boolean }> = {};
        (fbData as any[]).forEach((fb: any) => {
          const key = `${fb.session_id}-${fb.question_key}`;
          fbMap[key] = { feedback_text: fb.feedback_text || "", grade: fb.grade, saved: true };
        });
        setFeedbacks(fbMap);
      }
    }
    if (roomRes.data?.unlock_at) {
      const d = new Date(roomRes.data.unlock_at);
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      setUnlockAt(local);
    }
  }, [roomId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-manage:${roomId}`)
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
        table: "student_sessions",
        filter: `room_id=eq.${roomId}`,
      }, fetchData)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "student_activity_logs",
        filter: `room_id=eq.${roomId}`,
      }, fetchData)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "teacher_feedback",
      }, (payload: any) => {
        // Only refresh if this feedback is for a session in this room
        const sessionIds = sessions.map(s => s.id);
        if (payload.new && sessionIds.includes(payload.new.session_id)) {
          fetchData();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchData]);

  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/v\/|\/watch\?v=)([^&?\s]+)/);
    return match?.[1] || null;
  };

  const resetMaterialForm = () => {
    setNewMaterialType("video");
    setNewMaterialTitle("");
    setNewMaterialUrl("");
    setNewMaterialContent("");
    setSelectedFile(null);
    setDialogOpen(false);
  };

  const addMaterial = async () => {
    if (!roomId) return;
    if (newMaterialType !== "video" && newMaterialType !== "article" && !canUploadFile()) {
      toast({ title: "Upload de arquivos bloqueado", description: "Faça upgrade para o plano Professor para enviar arquivos.", variant: "destructive" });
      return;
    }
    setAddingMaterial(true);
    try {
      if (newMaterialType === "video") {
        const ytId = extractYoutubeId(newMaterialUrl);
        if (!ytId) {
          toast({ title: "URL inválida", description: "Cole um link válido do YouTube.", variant: "destructive" });
          setAddingMaterial(false);
          return;
        }
        const title = newMaterialTitle || "Vídeo do YouTube";
        const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        await supabase.from("materials").insert({
          room_id: roomId, type: "video", title, url: newMaterialUrl,
          thumbnail_url: thumbnail, content_text_for_ai: `YouTube video ID: ${ytId}. URL: ${newMaterialUrl}`,
        });
      } else if (newMaterialType === "article") {
        if (!newMaterialContent.trim()) {
          toast({ title: "Conteúdo vazio", description: "Cole o texto do artigo.", variant: "destructive" });
          setAddingMaterial(false);
          return;
        }
        await supabase.from("materials").insert({
          room_id: roomId, type: "article", title: newMaterialTitle || "Artigo",
          content_text_for_ai: newMaterialContent.trim(),
        });
      } else if (selectedFile) {
        setUploadingFile(true);
        const fileExt = selectedFile.name.split(".").pop();
        const filePath = `${roomId}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("materials").upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        // Store the public URL format for path detection (bucket is private, signed URLs used at render time)
        const { data: urlData } = supabase.storage.from("materials").getPublicUrl(filePath);
        let contentForAi = "";
        if (selectedFile.type === "text/plain" || selectedFile.name.endsWith(".txt") || selectedFile.name.endsWith(".md")) {
          contentForAi = await selectedFile.text();
        } else {
          contentForAi = newMaterialContent.trim() || "";
        }
        await supabase.from("materials").insert({
          room_id: roomId, type: newMaterialType, title: newMaterialTitle || selectedFile.name,
          url: urlData.publicUrl, content_text_for_ai: contentForAi || null,
        });
        setUploadingFile(false);
      } else if (newMaterialUrl.trim()) {
        await supabase.from("materials").insert({
          room_id: roomId, type: newMaterialType, title: newMaterialTitle || newMaterialUrl,
          url: newMaterialUrl, content_text_for_ai: newMaterialContent.trim() || null,
        });
      } else {
        toast({ title: "Dados insuficientes", description: "Adicione um arquivo, URL ou conteúdo.", variant: "destructive" });
        setAddingMaterial(false);
        return;
      }
      resetMaterialForm();
      fetchData();
      toast({ title: "Material adicionado!" });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar", description: err.message, variant: "destructive" });
    }
    setAddingMaterial(false);
    setUploadingFile(false);
  };

  const updateUnlockTime = async () => {
    if (!roomId || !unlockAt) return;
    const localDate = new Date(unlockAt);
    await supabase.from("rooms").update({ unlock_at: localDate.toISOString() }).eq("id", roomId);
    toast({ title: "Timer atualizado!" });
    fetchData();
  };

  const deleteMaterial = async (id: string) => {
    await supabase.from("materials").delete().eq("id", id);
    fetchData();
  };

  const deleteActivity = async (id: string) => {
    await supabase.from("activities").delete().eq("id", id);
    fetchData();
  };

  const deleteQuestionFromActivity = async (activityId: string, levelIndex: number, questionIndex: number, quiz: QuizData) => {
    const newLevels = quiz.levels.map((level, li) => {
      if (li !== levelIndex) return level;
      return { ...level, questions: level.questions.filter((_, qi) => qi !== questionIndex) };
    }).filter(level => level.questions.length > 0);

    if (newLevels.length === 0) {
      await supabase.from("activities").delete().eq("id", activityId);
      toast({ title: "Atividade removida", description: "Todas as questões foram deletadas." });
    } else {
      await supabase.from("activities").update({ quiz_data: { levels: newLevels } as unknown as Json }).eq("id", activityId);
      toast({ title: "Questão removida!" });
    }
    fetchData();
  };

  const isYoutubeLink = (mat: Material) => {
    return mat.type === "video" && mat.url && extractYoutubeId(mat.url);
  };

  const openTranscriptDialog = (material: Material) => {
    // First, show the activity type selection dialog
    setPendingMaterialForType(material);
    setSelectedActivityType("case_study");
    setActivityTypeDialogOpen(true);
  };

  const proceedWithGeneration = () => {
    const material = pendingMaterialForType;
    if (!material) return;
    setActivityTypeDialogOpen(false);
    setPendingMaterialForType(null);
    setSelectedMaterialForQuiz(material);

    if (isYoutubeLink(material)) {
      const cached = material.content_text_for_ai || "";
      const isPlaceholder = !cached || cached.length < 100 || cached.startsWith("YouTube video ID:");
      setManualTranscript(isPlaceholder ? "" : cached);
      setTranscriptDialogOpen(true);
    } else if (material.url && material.type !== "article") {
      const content = material.content_text_for_ai || "";
      if (content.length >= 50) {
        generateQuizDirect(material, content);
      } else {
        generateQuizFromFile(material);
      }
    } else {
      const content = material.content_text_for_ai || "";
      if (content.length >= 50) {
        generateQuizDirect(material, content);
      } else {
        setManualTranscript("");
        setTranscriptDialogOpen(true);
      }
    }
  };

  const generateQuizFromFile = async (material: Material) => {
    setGeneratingQuiz(material.id);
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Tempo limite excedido. O arquivo pode ser muito grande. Tente colar o conteúdo textual manualmente.")), 150000)
      );
      const fetchPromise = supabase.functions.invoke("generate-quiz", {
        body: { materialId: material.id, contentText: material.content_text_for_ai || "", roomId, materialType: material.type, fileUrl: material.url, activityType: selectedActivityType },
      });
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      if (response.error) {
        const errorMsg = typeof response.error === "object" && response.error.message ? response.error.message : String(response.error);
        if (errorMsg.includes("muito grande") || errorMsg.includes("WORKER_LIMIT")) {
          setGeneratingQuiz(null);
          setSelectedMaterialForQuiz(material);
          setManualTranscript("");
          setTranscriptDialogOpen(true);
          toast({ title: "Arquivo muito grande", description: "Cole o conteúdo textual manualmente para gerar a atividade.", variant: "destructive" });
          return;
        }
        throw new Error(errorMsg);
      }
      toast({ title: "Atividade gerada!", description: "A IA leu o documento e criou a atividade com sucesso." });
      fetchData();
    } catch (err: any) {
      const isTimeout = err.message?.includes("Tempo limite");
      if (isTimeout) {
        setSelectedMaterialForQuiz(material);
        setManualTranscript("");
        setTranscriptDialogOpen(true);
      }
      toast({ title: isTimeout ? "Tempo limite excedido" : "Erro ao gerar", description: err.message || "Tente novamente.", variant: "destructive" });
    }
    setGeneratingQuiz(null);
  };

  const generateQuizDirect = async (material: Material, content: string) => {
    setGeneratingQuiz(material.id);
    try {
      const response = await supabase.functions.invoke("generate-quiz", {
        body: { materialId: material.id, contentText: content, roomId, materialType: material.type, activityType: selectedActivityType },
      });
      if (response.error) throw response.error;
      toast({ title: "Atividade gerada!", description: "A atividade foi criada com sucesso." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message || "Tente novamente.", variant: "destructive" });
    }
    setGeneratingQuiz(null);
  };

  const generateQuizFromTranscript = async () => {
    if (!selectedMaterialForQuiz || !manualTranscript.trim()) {
      toast({ title: "Conteúdo vazio", description: "Cole o conteúdo do material antes de gerar.", variant: "destructive" });
      return;
    }
    setTranscriptDialogOpen(false);
    setGeneratingQuiz(selectedMaterialForQuiz.id);
    try {
      await supabase.from("materials").update({ content_text_for_ai: manualTranscript.trim() }).eq("id", selectedMaterialForQuiz.id);
      const response = await supabase.functions.invoke("generate-quiz", {
        body: { materialId: selectedMaterialForQuiz.id, contentText: manualTranscript.trim(), roomId, materialType: selectedMaterialForQuiz.type, activityType: selectedActivityType },
      });
      if (response.error) throw response.error;
      toast({ title: "Atividade gerada!", description: "A atividade foi criada com sucesso." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message || "Tente novamente.", variant: "destructive" });
    }
    setGeneratingQuiz(null);
    setSelectedMaterialForQuiz(null);
    setManualTranscript("");
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}min ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}min`;
  };

  const saveFeedback = async (sessionId: string, questionKey: string) => {
    const fbKey = `${sessionId}-${questionKey}`;
    const fb = feedbacks[fbKey];
    if (!fb) return;
    setSavingFeedback(fbKey);
    try {
      const { error } = await supabase
        .from("teacher_feedback" as any)
        .upsert({
          session_id: sessionId, question_key: questionKey,
          feedback_text: fb.feedback_text, grade: fb.grade,
        } as any, { onConflict: "session_id,question_key" });
      if (error) throw error;
      setFeedbacks(prev => ({ ...prev, [fbKey]: { ...prev[fbKey], saved: true } }));
      toast({ title: "Feedback salvo!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSavingFeedback(null);
  };

  const updateFeedbackField = (sessionId: string, questionKey: string, field: "feedback_text" | "grade", value: string | number | null) => {
    const fbKey = `${sessionId}-${questionKey}`;
    setFeedbacks(prev => {
      const current = prev[fbKey] || { feedback_text: "", grade: null, saved: false };
      return {
        ...prev,
        [fbKey]: { ...current, [field]: value, saved: false },
      };
    });
  };

  const aiGradeQuestion = async (sessionId: string, questionKey: string, question: string, context: string | undefined, correctAnswer: string, studentAnswer: string) => {
    const fbKey = `${sessionId}-${questionKey}`;
    setAiGrading(fbKey);
    try {
      const { data, error } = await supabase.functions.invoke("ai-grade", {
        body: { question, context: context || "", correctAnswer, studentAnswer },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data.results?.[0];
      if (!result) throw new Error("Sem resultado da IA");
      setAiResults(prev => ({ ...prev, [fbKey]: result }));
      const feedbackText = `${result.feedback}\n\n✅ Pontos fortes: ${result.strengths.join("; ")}\n⚠️ A melhorar: ${result.weaknesses.join("; ")}\n💡 Sugestão: ${result.suggestion}`;
      updateFeedbackField(sessionId, questionKey, "feedback_text", feedbackText);
      updateFeedbackField(sessionId, questionKey, "grade", result.grade);
      toast({ title: "Correção por IA concluída!", description: `Nota sugerida: ${result.grade}/10. Revise e salve.` });
    } catch (err: any) {
      toast({ title: "Erro na correção por IA", description: err.message, variant: "destructive" });
    }
    setAiGrading(null);
  };

  const aiGradeAllStudent = async (sessionId: string, quizData: QuizData, studentAnswers: Record<string, string>) => {
    setAiGradingAll(sessionId);
    try {
      const batchItems: any[] = [];
      const keys: string[] = [];
      quizData.levels?.forEach((level, li) => {
        level.questions?.forEach((q, qi) => {
          const key = `${li}-${qi}`;
          keys.push(key);
          batchItems.push({ question: q.question, context: q.context || "", correctAnswer: q.correct_answer, studentAnswer: studentAnswers[key] || "" });
        });
      });
      const { data, error } = await supabase.functions.invoke("ai-grade", { body: { batchItems } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const results = data.results || [];
      results.forEach((result: any, i: number) => {
        const key = keys[i];
        const fbKey = `${sessionId}-${key}`;
        setAiResults(prev => ({ ...prev, [fbKey]: result }));
        const feedbackText = `${result.feedback}\n\n✅ Pontos fortes: ${result.strengths.join("; ")}\n⚠️ A melhorar: ${result.weaknesses.join("; ")}\n💡 Sugestão: ${result.suggestion}`;
        updateFeedbackField(sessionId, key, "feedback_text", feedbackText);
        updateFeedbackField(sessionId, key, "grade", result.grade);
      });
      toast({ title: "Todas as respostas corrigidas!", description: `${results.length} questões avaliadas pela IA. Revise e salve.` });
    } catch (err: any) {
      toast({ title: "Erro na correção por IA", description: err.message, variant: "destructive" });
    }
    setAiGradingAll(null);
  };

  const openSaveToBankDialog = (activity: Activity) => {
    setActivityToSave(activity);
    const quiz = activity.quiz_data as unknown as QuizData;
    const totalQ = quiz?.levels?.reduce((s, l) => s + (l.questions?.length || 0), 0) || 0;
    setBankTitle(`Atividade — ${totalQ} questões`);
    setSaveBankDialogOpen(true);
  };

  const saveToBank = async () => {
    if (!activityToSave || !bankTitle.trim()) return;
    setSavingToBank(activityToSave.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("question_bank" as any)
        .insert({ teacher_id: user.id, title: bankTitle.trim(), quiz_data: activityToSave.quiz_data } as any);
      if (error) throw error;
      toast({ title: "Salvo no banco!", description: "Atividade salva na sua biblioteca pessoal." });
      setSaveBankDialogOpen(false);
      setActivityToSave(null);
      setBankTitle("");
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSavingToBank(null);
  };

  const loadBankItems = async () => {
    setLoadingBank(true);
    try {
      const { data, error } = await supabase.from("question_bank" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setBankItems(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar", description: err.message, variant: "destructive" });
    }
    setLoadingBank(false);
  };

  const importFromBank = async (bankItem: any) => {
    if (!roomId) return;
    try {
      const { error } = await supabase.from("activities").insert({ room_id: roomId, quiz_data: bankItem.quiz_data });
      if (error) throw error;
      toast({ title: "Atividade importada!", description: `"${bankItem.title}" foi adicionada a esta sala.` });
      setBankDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    }
  };

  const deleteBankItem = async (id: string) => {
    try {
      const { error } = await supabase.from("question_bank" as any).delete().eq("id", id);
      if (error) throw error;
      setBankItems(prev => prev.filter(b => b.id !== id));
      toast({ title: "Removido do banco!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Toggle publish/unpublish for materials or activities
  const togglePublish = async (table: "materials" | "activities", id: string, currentValue: boolean) => {
    const { error } = await supabase.from(table).update({ is_published: !currentValue } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: !currentValue ? "Publicado para alunos" : "Ocultado dos alunos" });
    fetchData();
  };

  // Manual activity creation
  const resetManualActivityForm = () => {
    setManualActivityTitle("");
    setManualLevels(LEVEL_TEMPLATES.map(t => ({ ...t, questions: [{ question: "", type: "case_study", context: "", correct_answer: "" }] })));
    setManualActivityDialogOpen(false);
  };

  const addManualQuestion = (levelIndex: number) => {
    setManualLevels(prev => prev.map((l, i) =>
      i === levelIndex ? { ...l, questions: [...l.questions, { question: "", type: "case_study", context: "", correct_answer: "" }] } : l
    ));
  };

  const removeManualQuestion = (levelIndex: number, questionIndex: number) => {
    setManualLevels(prev => prev.map((l, i) =>
      i === levelIndex ? { ...l, questions: l.questions.filter((_, qi) => qi !== questionIndex) } : l
    ));
  };

  const updateManualQuestion = (levelIndex: number, questionIndex: number, field: keyof QuizQuestion, value: string) => {
    setManualLevels(prev => prev.map((l, li) =>
      li === levelIndex ? {
        ...l, questions: l.questions.map((q, qi) => qi === questionIndex ? { ...q, [field]: value } : q)
      } : l
    ));
  };

  const saveManualActivity = async () => {
    if (!roomId) return;
    // Validate: at least one question with content
    const hasContent = manualLevels.some(l => l.questions.some(q => q.question.trim()));
    if (!hasContent) {
      toast({ title: "Atividade vazia", description: "Adicione pelo menos uma questão.", variant: "destructive" });
      return;
    }
    // Filter out empty levels/questions
    const filteredLevels = manualLevels
      .map(l => ({ ...l, questions: l.questions.filter(q => q.question.trim()) }))
      .filter(l => l.questions.length > 0);

    setSavingManualActivity(true);
    try {
      const { error } = await supabase.from("activities").insert({
        room_id: roomId,
        quiz_data: { levels: filteredLevels } as unknown as Json,
        title: manualActivityTitle.trim() || "Atividade Manual",
      } as any);
      if (error) throw error;
      toast({ title: "Atividade criada!", description: "A atividade manual foi adicionada à sala." });
      resetManualActivityForm();
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao criar", description: err.message, variant: "destructive" });
    }
    setSavingManualActivity(false);
  };

  // Count unique emails for student count
  const uniqueEmails = new Set(sessions.map(s => (s as any).student_email?.toLowerCase()).filter(Boolean));
  const totalStudents = uniqueEmails.size || sessions.length;

  const studentStats: StudentStats[] = sessions.map(session => {
    const sessionLogs = activityLogs.filter(l => l.session_id === session.id);
    const totalTime = sessionLogs.reduce((s, l) => s + (l.duration_seconds || 0), 0);
    const materialViews = sessionLogs.filter(l => l.activity_type === "material_view" && l.material_id);
    const materialsWithTime = new Set<string>();
    materialViews.forEach(l => {
      if (l.material_id) materialsWithTime.add(l.material_id);
    });
    const materialsViewed = materialsWithTime.size;
    const quizTime = sessionLogs.filter(l => l.activity_type === "quiz_start" || l.activity_type === "quiz_complete")
      .reduce((s, l) => s + (l.duration_seconds || 0), 0);
    return { session, totalTime, materialsViewed, quizTime };
  });

  const completedStudents = sessions.filter(s => s.completed_at).length;
  const avgScore = completedStudents > 0
    ? Math.round(sessions.filter(s => s.completed_at).reduce((s, sess) => s + (sess.score || 0), 0) / completedStudents)
    : 0;
  const totalPlatformTime = studentStats.reduce((s, st) => s + st.totalTime, 0);

  if (!room) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;

  const getTranscriptDialogTitle = () => {
    if (!selectedMaterialForQuiz) return "Conteúdo do Material";
    if (isYoutubeLink(selectedMaterialForQuiz)) return "Transcrição do Vídeo";
    return `Conteúdo do ${getMaterialLabel(selectedMaterialForQuiz.type)}`;
  };

  const getTranscriptDialogDescription = () => {
    if (!selectedMaterialForQuiz) return "";
    if (isYoutubeLink(selectedMaterialForQuiz)) {
      return 'Cole abaixo a transcrição/legendas do vídeo. A IA usará esse conteúdo para gerar os casos aplicados. Você pode copiar a transcrição diretamente do YouTube (clique nos 3 pontos do vídeo → "Mostrar transcrição").';
    }
    return "Cole abaixo o conteúdo textual deste material. A IA usará esse texto para gerar atividades baseadas em casos reais.";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 bg-card flex items-center gap-4 sticky top-0 z-20">
        <div>
          <h1 className="font-display text-xl font-bold">{room.title}</h1>
          <p className="text-sm text-muted-foreground">PIN: <span className="font-mono font-bold text-foreground">{room.pin_code}</span></p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* Uso de IA no mês - only for owner */}
        {isOwner && (
        <section className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Uso de IA (mês atual)
            </h2>
            <p className="text-xs text-muted-foreground">Atualizado automaticamente</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-secondary rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Geração de Quiz</p>
              <p className="font-display text-2xl font-bold text-foreground">{aiUsage.generations}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Limite: {limits.ai_generations_per_month === -1 ? "Ilimitado" : limits.ai_generations_per_month}
              </p>
            </div>
            <div className="bg-secondary rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Correção por IA</p>
              <p className="font-display text-2xl font-bold text-foreground">{aiUsage.corrections}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Limite: {limits.ai_corrections_per_month === -1 ? "Ilimitado" : limits.ai_corrections_per_month}
              </p>
            </div>
          </div>
        </section>
        )}
        {/* Timer Section - only for owner */}
        {isOwner && (
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
        )}

        {/* Student Management */}
        {roomId && isOwner && <RoomStudents roomId={roomId} />}
        {roomId && room && isOwner && <RoomCollaborators roomId={roomId} ownerId={room.teacher_id} />}

        {/* Materials Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Materiais</h2>
            {isOwner && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetMaterialForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar Material</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle className="font-display">Adicionar Material</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Tipo de material</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {MATERIAL_TYPES.map((t) => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.value}
                            onClick={() => { setNewMaterialType(t.value); setSelectedFile(null); setNewMaterialUrl(""); setNewMaterialContent(""); }}
                            className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                              newMaterialType === t.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-foreground/30"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Título (opcional)</Label>
                    <Input placeholder="Ex: Aula 1 — Introdução" value={newMaterialTitle} onChange={(e) => setNewMaterialTitle(e.target.value)} />
                  </div>

                  {newMaterialType === "video" && (
                    <div className="space-y-2">
                      <Label>URL do YouTube</Label>
                      <Input placeholder="https://youtube.com/watch?v=..." value={newMaterialUrl} onChange={(e) => setNewMaterialUrl(e.target.value)} />
                    </div>
                  )}
                  {newMaterialType === "article" && (
                    <div className="space-y-2">
                      <Label>Conteúdo do artigo</Label>
                      <Textarea placeholder="Cole aqui o texto completo do artigo..." value={newMaterialContent} onChange={(e) => setNewMaterialContent(e.target.value)} rows={8} className="resize-y" />
                    </div>
                  )}
                  {(newMaterialType === "pdf" || newMaterialType === "presentation") && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Upload do arquivo</Label>
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <input type="file" accept={newMaterialType === "pdf" ? ".pdf" : ".pdf,.ppt,.pptx,.odp"} onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" id="file-upload" />
                          <label htmlFor="file-upload" className="cursor-pointer text-sm text-primary hover:underline">
                            {selectedFile ? selectedFile.name : "Clique para selecionar arquivo"}
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Conteúdo textual para IA (cole o texto do {newMaterialType === "pdf" ? "PDF" : "slides"})</Label>
                        <Textarea placeholder={`Cole aqui o conteúdo textual...`} value={newMaterialContent} onChange={(e) => setNewMaterialContent(e.target.value)} rows={6} className="resize-y" />
                        <p className="text-xs text-muted-foreground">A IA usará este texto para gerar atividades.</p>
                      </div>
                    </div>
                  )}
                  {newMaterialType === "podcast" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>URL do podcast / áudio (MP3, etc.)</Label>
                        <Input placeholder="https://..." value={newMaterialUrl} onChange={(e) => setNewMaterialUrl(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Transcrição / conteúdo do podcast</Label>
                        <Textarea placeholder="Cole aqui a transcrição do podcast..." value={newMaterialContent} onChange={(e) => setNewMaterialContent(e.target.value)} rows={6} className="resize-y" />
                      </div>
                    </div>
                  )}

                  <Button onClick={addMaterial} disabled={addingMaterial || uploadingFile} className="w-full">
                    {addingMaterial || uploadingFile ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-1" /> {uploadingFile ? "Enviando arquivo..." : "Adicionando..."}</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-1" /> Adicionar</>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            )}
          </div>

          {materials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
              <FileText className="w-8 h-8 mx-auto mb-2" />
              <p>Nenhum material adicionado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((mat) => {
                const MatIcon = getMaterialIcon(mat.type);
                const hasContent = mat.content_text_for_ai && mat.content_text_for_ai.length >= 50 && !mat.content_text_for_ai.startsWith("YouTube video ID:");
                const isPublished = (mat as any).is_published !== false;
                return (
                  <div key={mat.id} className={`bg-card border rounded-xl p-4 flex items-center gap-4 ${isPublished ? "border-border" : "border-dashed border-muted-foreground/30 opacity-70"}`}>
                    {mat.thumbnail_url ? (
                      <img src={mat.thumbnail_url} alt="" className="w-24 h-16 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-24 h-16 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <MatIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-card-foreground truncate">{mat.title || mat.url}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{getMaterialLabel(mat.type)}</p>
                        {hasContent && (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <Check className="w-3 h-3" /> Conteúdo para IA
                          </span>
                        )}
                        {!isPublished && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <EyeOff className="w-3 h-3" /> Oculto
                          </span>
                        )}
                      </div>
                    </div>
                    {isOwner && (
                    <div className="flex gap-2 flex-shrink-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => togglePublish("materials", mat.id, isPublished)}>
                              {isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{isPublished ? "Ocultar dos alunos" : "Publicar para alunos"}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openTranscriptDialog(mat)}
                                disabled={generatingQuiz === mat.id || !canGenerateQuiz()}
                              >
                                {generatingQuiz === mat.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : !canGenerateQuiz() ? (
                                  <Lock className="w-4 h-4 mr-1" />
                                ) : (
                                  <Sparkles className="w-4 h-4 mr-1" />
                                )}
                                Gerar Atividade
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!canGenerateQuiz() && (
                            <TooltipContent>Limite de gerações IA atingido neste mês. Faça upgrade para mais.</TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                      <Button size="sm" variant="ghost" onClick={() => deleteMaterial(mat.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Transcript / Content Dialog */}
        <Dialog open={transcriptDialogOpen} onOpenChange={setTranscriptDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <FileEdit className="w-5 h-5" /> {getTranscriptDialogTitle()}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">{getTranscriptDialogDescription()}</p>
              <Textarea placeholder="Cole aqui o conteúdo do material..." value={manualTranscript} onChange={(e) => setManualTranscript(e.target.value)} rows={12} className="resize-y" />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">{manualTranscript.length > 0 ? `${manualTranscript.length} caracteres` : ""}</p>
                <Button onClick={generateQuizFromTranscript} disabled={!manualTranscript.trim() || !!generatingQuiz}>
                  {generatingQuiz ? (<><Loader2 className="w-4 h-4 animate-spin mr-1" /> Gerando...</>) : (<><Sparkles className="w-4 h-4 mr-1" /> Gerar Atividade</>)}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Activity Type Selection Dialog */}
        <Dialog open={activityTypeDialogOpen} onOpenChange={setActivityTypeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> Tipo de Atividade
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Escolha o tipo de atividade que a IA irá gerar:</p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedActivityType("quiz")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${selectedActivityType === "quiz" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedActivityType === "quiz" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-card-foreground">Quiz — Múltipla Escolha</p>
                      <p className="text-xs text-muted-foreground">5 questões com 4 alternativas cada</p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedActivityType("case_study")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${selectedActivityType === "case_study" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedActivityType === "case_study" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Lightbulb className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-card-foreground">Casos Clínicos</p>
                      <p className="text-xs text-muted-foreground">Casos reais com perguntas dissertativas em 3 níveis</p>
                    </div>
                  </div>
                </button>
              </div>
              <div className="flex justify-end">
                <Button onClick={proceedWithGeneration}>
                  <Sparkles className="w-4 h-4 mr-1" /> Gerar Atividade
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Activities Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Atividades</h2>
            {isOwner && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setManualActivityDialogOpen(true)}>
                <PenLine className="w-4 h-4 mr-1" /> Criar Manualmente
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setBankDialogOpen(true); loadBankItems(); }}>
                <Library className="w-4 h-4 mr-1" /> Banco de Questões
              </Button>
            </div>
            )}
          </div>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((act, i) => {
                const quiz = act.quiz_data as unknown as QuizData;
                const isExpanded = expandedActivity === act.id;
                const isPublished = (act as any).is_published !== false;
                const actTitle = (act as any).title || `Atividade ${i + 1}`;
                return (
                  <div key={act.id} className={`bg-card border rounded-xl overflow-hidden ${isPublished ? "border-border" : "border-dashed border-muted-foreground/30 opacity-70"}`}>
                    <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedActivity(isExpanded ? null : act.id)}>
                      <div>
                        <p className="font-medium text-card-foreground">{actTitle}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            Criada em {new Date(act.created_at).toLocaleDateString("pt-BR")} •{" "}
                            {quiz?.levels?.reduce((sum, l) => sum + (l.questions?.length || 0), 0) || 0} questões
                          </p>
                          {!isPublished && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <EyeOff className="w-3 h-3" /> Oculta
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwner && (
                        <>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); togglePublish("activities", act.id, isPublished); }}>
                                {isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isPublished ? "Ocultar dos alunos" : "Publicar para alunos"}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openSaveToBankDialog(act); }} title="Salvar no Banco de Questões">
                          {savingToBank === act.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkPlus className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteActivity(act.id); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        </>
                        )}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      </div>
                    </div>
                    {isExpanded && quiz?.levels && (
                      <div className="border-t border-border p-4 space-y-4">
                        {quiz.levels.map((level, li) => (
                          <div key={li}>
                            <p className="font-semibold text-sm text-primary mb-2">{level.label}</p>
                            {level.questions?.map((q, qi) => (
                              <div key={qi} className="mb-3 bg-secondary rounded-lg p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    {q.context && <p className="text-xs text-muted-foreground mb-2 italic">{q.context}</p>}
                                    <p className="font-medium text-sm text-foreground mb-1">{qi + 1}. {q.question}</p>
                                  </div>
                                  {isOwner && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive flex-shrink-0"
                                      onClick={() => deleteQuestionFromActivity(act.id, li, qi, quiz)}
                                      title="Remover questão"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                                {q.type === "multiple_choice" && q.options && q.options.length > 0 && (
                                  <div className="mt-2 mb-2 space-y-1">
                                    {q.options.map((opt, oi) => {
                                      const cleanOpt = opt.replace(/^[A-Da-d]\)\s*/, "");
                                      return (
                                        <p key={oi} className={`text-xs px-3 py-1.5 rounded ${opt === q.correct_answer ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}>
                                          {String.fromCharCode(65 + oi)}) {cleanOpt}
                                        </p>
                                      );
                                    })}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground"><span className="font-semibold">Resposta esperada:</span> {q.correct_answer}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
              <FileText className="w-8 h-8 mx-auto mb-2" />
              <p>Nenhuma atividade criada ainda. Use "Gerar Atividade" nos materiais, "Criar Manualmente" ou importe do Banco de Questões.</p>
            </div>
          )}
        </section>

        {/* Manual Activity Dialog */}
        <Dialog open={manualActivityDialogOpen} onOpenChange={(open) => { if (!open) resetManualActivityForm(); else setManualActivityDialogOpen(true); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <PenLine className="w-5 h-5" /> Criar Atividade Manualmente
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-2">
              <div className="space-y-2">
                <Label>Título da atividade</Label>
                <Input placeholder="Ex: Estudo de caso — Farmacologia" value={manualActivityTitle} onChange={(e) => setManualActivityTitle(e.target.value)} />
              </div>

              {manualLevels.map((level, li) => (
                <div key={li} className="border border-border rounded-xl p-4 space-y-4">
                  <h3 className="font-semibold text-sm text-primary">{level.label}</h3>
                  {level.questions.map((q, qi) => (
                    <div key={qi} className="bg-secondary rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground">Questão {qi + 1}</p>
                        {level.questions.length > 1 && (
                          <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => removeManualQuestion(li, qi)}>
                            <Trash2 className="w-3 h-3 mr-1" /> Remover
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Contexto do caso (opcional)</Label>
                        <Textarea
                          placeholder="Descreva o cenário clínico, caso ou situação..."
                          value={q.context || ""}
                          onChange={(e) => updateManualQuestion(li, qi, "context", e.target.value)}
                          rows={3}
                          className="resize-y text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Pergunta *</Label>
                        <Textarea
                          placeholder="Qual a pergunta para o aluno?"
                          value={q.question}
                          onChange={(e) => updateManualQuestion(li, qi, "question", e.target.value)}
                          rows={2}
                          className="resize-y text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Resposta esperada</Label>
                        <Textarea
                          placeholder="Resposta de referência para correção..."
                          value={q.correct_answer}
                          onChange={(e) => updateManualQuestion(li, qi, "correct_answer", e.target.value)}
                          rows={2}
                          className="resize-y text-sm"
                        />
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => addManualQuestion(li)}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar Questão
                  </Button>
                </div>
              ))}

              <Button onClick={saveManualActivity} disabled={savingManualActivity} className="w-full">
                {savingManualActivity ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Salvando...</> : <><PenLine className="w-4 h-4 mr-1" /> Criar Atividade</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Student Statistics Section */}
        <section>
          <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" /> Estatísticas dos Alunos
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="font-display text-2xl font-bold text-foreground">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">Alunos (emails únicos)</p>
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

          <div className="flex gap-4 mb-4 border-b border-border">
            <button onClick={() => setStatsTab("overview")} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${statsTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Resumo</button>
            <button onClick={() => setStatsTab("details")} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${statsTab === "details" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Detalhado</button>
            <button onClick={() => setStatsTab("answers")} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${statsTab === "answers" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><MessageSquare className="w-3.5 h-3.5 inline mr-1" />Respostas</button>
            <button onClick={() => setStatsTab("reports")} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${statsTab === "reports" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><TrendingUp className="w-3.5 h-3.5 inline mr-1" />Relatórios</button>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2" />
              <p>Nenhum aluno entrou nesta sala ainda.</p>
            </div>
          ) : statsTab === "reports" ? (
            <AnalyticsReport sessions={sessions} activityLogs={activityLogs} materials={materials} />
          ) : statsTab === "overview" ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{s.student_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{(s as any).student_email || "—"}</td>
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
          ) : statsTab === "details" ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tempo na Plataforma</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Materiais Vistos</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tempo no Quiz</th>
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
            /* Answers tab */
            <div className="space-y-3">
              {sessions.filter(s => s.completed_at && s.answers).map((s) => {
                const studentAnswers = s.answers as Record<string, string>;
                const isExpanded = expandedStudent === s.id;
                // Use all activities for answers display
                const allQuizLevels = activities.flatMap(act => {
                  const q = act.quiz_data as unknown as QuizData;
                  return q?.levels || [];
                });
                const combinedQuiz: QuizData = { levels: allQuizLevels };
                return (
                  <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedStudent(isExpanded ? null : s.id)}>
                      <div>
                        <p className="font-medium text-card-foreground">{s.student_name}</p>
                        <p className="text-xs text-muted-foreground">{(s as any).student_email || ""} • Concluído em {new Date(s.completed_at!).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded && combinedQuiz.levels.length > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm" variant="outline" className="text-xs"
                                    disabled={aiGradingAll === s.id || !canUseAiCorrection()}
                                    onClick={(e) => { e.stopPropagation(); aiGradeAllStudent(s.id, combinedQuiz, studentAnswers || {}); }}
                                  >
                                    {aiGradingAll === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : !canUseAiCorrection() ? <Lock className="w-3.5 h-3.5 mr-1" /> : <Bot className="w-3.5 h-3.5 mr-1" />}
                                    Corrigir Todas com IA
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {!canUseAiCorrection() && <TooltipContent>Limite de correções IA atingido neste mês.</TooltipContent>}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      </div>
                    </div>
                    {isExpanded && combinedQuiz.levels.length > 0 && (
                      <div className="border-t border-border p-4 space-y-4">
                        {combinedQuiz.levels.map((level, li) => (
                          <div key={li}>
                            <p className="font-semibold text-sm text-primary mb-2">{level.label}</p>
                            {level.questions?.map((q, qi) => {
                              const key = `${li}-${qi}`;
                              const answer = studentAnswers?.[key];
                              return (
                                <div key={qi} className="mb-3 bg-secondary rounded-lg p-4">
                                  {q.context && <p className="text-xs text-muted-foreground mb-2 italic">{q.context}</p>}
                                  <p className="font-medium text-sm text-foreground mb-2">{qi + 1}. {q.question}</p>
                                  <div className="bg-background rounded-lg p-3 mb-2">
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Resposta do aluno:</p>
                                    <p className="text-sm text-foreground">{answer || <span className="italic text-muted-foreground">Não respondida</span>}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3"><span className="font-semibold">Resposta esperada:</span> {q.correct_answer}</p>
                                  {/* Feedback do professor */}
                                  <div className="border-t border-border pt-3 mt-3 space-y-3">
                                    {(() => {
                                      const fbKey = `${s.id}-${key}`;
                                      const fb = feedbacks[fbKey];
                                      const isSaved = fb?.saved === true;
                                      return (
                                        <>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <p className="text-xs font-semibold text-primary">Feedback do Professor</p>
                                              {isSaved && <Check className="w-3.5 h-3.5 text-level-easy" />}
                                            </div>
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span>
                                                    <Button size="sm" variant="ghost" className="text-xs h-7 gap-1"
                                                      disabled={aiGrading === fbKey || !answer || !canUseAiCorrection()}
                                                      onClick={() => aiGradeQuestion(s.id, key, q.question, q.context, q.correct_answer, answer || "")}
                                                    >
                                                      {aiGrading === fbKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : !canUseAiCorrection() ? <Lock className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                                                      Corrigir com IA
                                                    </Button>
                                                  </span>
                                                </TooltipTrigger>
                                                {!canUseAiCorrection() && <TooltipContent>Limite de correções IA atingido.</TooltipContent>}
                                              </Tooltip>
                                            </TooltipProvider>
                                          </div>
                                          {aiResults[fbKey] && (
                                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs space-y-1.5">
                                              <div className="flex items-center gap-2 font-semibold text-primary"><Bot className="w-3.5 h-3.5" /> Sugestão da IA — Nota: {aiResults[fbKey].grade}/10</div>
                                              {aiResults[fbKey].strengths.length > 0 && <p className="text-foreground/80"><ThumbsUp className="w-3 h-3 inline mr-1 text-primary" />{aiResults[fbKey].strengths.join("; ")}</p>}
                                              {aiResults[fbKey].weaknesses.length > 0 && <p className="text-foreground/80"><ThumbsDown className="w-3 h-3 inline mr-1 text-destructive" />{aiResults[fbKey].weaknesses.join("; ")}</p>}
                                              {aiResults[fbKey].suggestion && <p className="text-foreground/80"><Lightbulb className="w-3 h-3 inline mr-1 text-accent" />{aiResults[fbKey].suggestion}</p>}
                                            </div>
                                          )}
                                          <Textarea
                                            placeholder="Escreva seu feedback para esta resposta..."
                                            value={fb?.feedback_text || ""}
                                            onChange={(e) => updateFeedbackField(s.id, key, "feedback_text", e.target.value)}
                                            rows={3}
                                            className="resize-y text-sm"
                                            disabled={isSaved}
                                          />
                                          <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                              <Label className="text-xs text-muted-foreground">Nota:</Label>
                                              <Select
                                                value={fb?.grade?.toString() ?? ""}
                                                onValueChange={(v) => updateFeedbackField(s.id, key, "grade", v === "" ? null : parseInt(v))}
                                                disabled={isSaved}
                                              >
                                                <SelectTrigger className="w-20 h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                                                <SelectContent>
                                                  {Array.from({ length: 11 }, (_, i) => (<SelectItem key={i} value={i.toString()}>{i}</SelectItem>))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            {isSaved ? (
                                              <Button size="sm" variant="outline" onClick={() => setFeedbacks(prev => ({ ...prev, [fbKey]: { ...prev[fbKey], saved: false } }))}>
                                                <FileEdit className="w-3.5 h-3.5 mr-1" /> Editar
                                              </Button>
                                            ) : (
                                              <Button size="sm" variant="outline" onClick={() => saveFeedback(s.id, key)} disabled={savingFeedback === fbKey}>
                                                {savingFeedback === fbKey ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                                                Salvar
                                              </Button>
                                            )}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {sessions.filter(s => s.completed_at && s.answers).length === 0 && (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                  <p>Nenhum aluno enviou respostas ainda.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Peer Review Section */}
        {activities.filter(a => (a as any).is_published !== false).length > 0 && (
          <section className="bg-card rounded-xl border border-border p-6">
            {!canUsePeerReview() ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Lock className="w-5 h-5" />
                <div>
                  <p className="font-medium text-foreground">Avaliação por Pares</p>
                  <p className="text-sm">Disponível a partir do plano Professor. <button onClick={() => navigate("/pricing")} className="text-primary underline">Fazer upgrade</button></p>
                </div>
              </div>
            ) : (
              <PeerReviewTeacher
                activityId={activities.filter(a => (a as any).is_published !== false)[0].id}
                roomId={roomId!}
                sessions={sessions}
                quizData={activities.filter(a => (a as any).is_published !== false)[0].quiz_data as unknown as QuizData}
                peerReviewEnabled={(activities.filter(a => (a as any).is_published !== false)[0] as any).peer_review_enabled || false}
                peerReviewCriteria={((activities.filter(a => (a as any).is_published !== false)[0] as any).peer_review_criteria as any[]) || []}
                onUpdate={fetchData}
              />
            )}
          </section>
        )}

        {/* Discussion Forum Section */}
        <section>
          <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-primary" /> Fórum de Discussão
          </h2>
          {roomId && <DiscussionForum roomId={roomId} teacherUserId={room.teacher_id} />}
        </section>
      </main>

      {/* Save to Bank Dialog */}
      <Dialog open={saveBankDialogOpen} onOpenChange={setSaveBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><BookmarkPlus className="w-5 h-5" /> Salvar no Banco de Questões</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Título da atividade</Label>
              <Input placeholder="Ex: Farmacologia — Casos de Antibióticos" value={bankTitle} onChange={(e) => setBankTitle(e.target.value)} />
            </div>
            {activityToSave && (
              <p className="text-xs text-muted-foreground">
                {((activityToSave.quiz_data as unknown as QuizData)?.levels?.reduce((s, l) => s + (l.questions?.length || 0), 0)) || 0} questões serão salvas
              </p>
            )}
            <Button onClick={saveToBank} disabled={!bankTitle.trim() || !!savingToBank} className="w-full">
              {savingToBank ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Salvando...</> : <><BookmarkPlus className="w-4 h-4 mr-1" /> Salvar</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Bank Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><Library className="w-5 h-5" /> Banco de Questões</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Sua biblioteca pessoal de atividades. Importe qualquer uma para esta sala.</p>
            {loadingBank ? (
              <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : bankItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Library className="w-8 h-8 mx-auto mb-2" />
                <p>Nenhuma atividade salva ainda.</p>
                <p className="text-xs mt-1">Use o botão <BookmarkPlus className="w-3 h-3 inline" /> nas atividades geradas para salvar aqui.</p>
              </div>
            ) : (
              bankItems.map((item) => {
                const quiz = item.quiz_data as unknown as QuizData;
                const totalQ = quiz?.levels?.reduce((s: number, l: any) => s + (l.questions?.length || 0), 0) || 0;
                return (
                  <div key={item.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-card-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{totalQ} questões • Salva em {new Date(item.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => importFromBank(item)}><Download className="w-4 h-4 mr-1" /> Importar</Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteBankItem(item.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomManage;

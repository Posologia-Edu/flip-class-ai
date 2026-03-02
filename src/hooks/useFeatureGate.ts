import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { getPlanLimits, type PlanKey } from "@/lib/subscription";

const PLAN_HIERARCHY: Record<PlanKey, number> = {
  free: 0,
  professor: 1,
  institutional: 2,
};

function resolveHighestPlan(a: PlanKey, b: PlanKey | null): PlanKey {
  if (!b) return a;
  return PLAN_HIERARCHY[a] >= PLAN_HIERARCHY[b] ? a : b;
}

export function useFeatureGate() {
  const { user } = useAuth();
  const { planKey: stripePlan, loading: subLoading, subscriptionEnd } = useSubscription(user?.id);
  const [grantedPlan, setGrantedPlan] = useState<PlanKey | null>(null);
  const [grantedLoading, setGrantedLoading] = useState(true);
  const [aiUsage, setAiUsage] = useState<{ generations: number; corrections: number }>({ generations: 0, corrections: 0 });

  // Fetch granted plan from admin_invites
  useEffect(() => {
    const fetchGrantedPlan = async () => {
      if (!user?.email) {
        setGrantedPlan(null);
        setGrantedLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("admin_invites")
          .select("granted_plan, status")
          .eq("email", user.email.toLowerCase())
          .in("status", ["active", "pending"])
          .maybeSingle();
        if (data?.granted_plan) {
          const plan = data.granted_plan as PlanKey;
          if (plan in PLAN_HIERARCHY) {
            setGrantedPlan(plan);
          }
        }
      } catch {
        // ignore
      }
      setGrantedLoading(false);
    };
    fetchGrantedPlan();
  }, [user?.email]);

  // Fetch AI usage for current month
  const fetchAiUsage = useCallback(async () => {
    if (!user?.id) return;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    try {
      const { data } = await supabase
        .from("ai_usage_log")
        .select("usage_type")
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth);
      const generations = (data || []).filter(d => d.usage_type === "generation").length;
      const corrections = (data || []).filter(d => d.usage_type === "correction").length;
      setAiUsage({ generations, corrections });
    } catch {
      // ignore
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAiUsage();
  }, [fetchAiUsage]);

  // Real-time AI usage updates
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`ai-usage:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "ai_usage_log",
      }, fetchAiUsage)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchAiUsage]);

  const effectivePlan = resolveHighestPlan(stripePlan, grantedPlan);
  const limits = getPlanLimits(effectivePlan);
  const loading = subLoading || grantedLoading;
  const isAdminGranted = grantedPlan !== null && PLAN_HIERARCHY[grantedPlan] > PLAN_HIERARCHY[stripePlan];

  const canCreateRoom = useCallback((currentCount: number) => {
    return limits.max_rooms === -1 || currentCount < limits.max_rooms;
  }, [limits.max_rooms]);

  const canUploadFile = useCallback(() => limits.file_upload, [limits.file_upload]);
  const canUsePeerReview = useCallback(() => limits.peer_review, [limits.peer_review]);
  const canUseQuestionBank = useCallback(() => limits.question_bank, [limits.question_bank]);
  const canUseAdvancedAnalytics = useCallback(() => limits.advanced_analytics, [limits.advanced_analytics]);

  const canGenerateQuiz = useCallback(() => {
    if (limits.ai_generations_per_month === -1) return true;
    return aiUsage.generations < limits.ai_generations_per_month;
  }, [limits.ai_generations_per_month, aiUsage.generations]);

  const canUseAiCorrection = useCallback(() => {
    if (limits.ai_corrections_per_month === -1) return true;
    return aiUsage.corrections < limits.ai_corrections_per_month;
  }, [limits.ai_corrections_per_month, aiUsage.corrections]);

  const getRoomStudentLimit = useCallback(() => limits.max_students_per_room, [limits.max_students_per_room]);
  const getRoomLimit = useCallback(() => limits.max_rooms, [limits.max_rooms]);

  const canExportReports = useCallback(() => effectivePlan === "institutional", [effectivePlan]);
  const canUseMultiTeacher = useCallback(() => effectivePlan === "institutional", [effectivePlan]);
  const canUseWhiteLabel = useCallback(() => effectivePlan === "institutional", [effectivePlan]);
  const canInviteTeacher = useCallback((currentCount: number) => {
    return limits.max_teachers > 0 && currentCount < limits.max_teachers;
  }, [limits.max_teachers]);
  const getTeacherLimit = useCallback(() => limits.max_teachers, [limits.max_teachers]);

  return {
    effectivePlan,
    limits,
    loading,
    isAdminGranted,
    grantedPlan,
    subscriptionEnd,
    aiUsage,
    canCreateRoom,
    canUploadFile,
    canUsePeerReview,
    canUseQuestionBank,
    canUseAdvancedAnalytics,
    canGenerateQuiz,
    canUseAiCorrection,
    getRoomStudentLimit,
    getRoomLimit,
    canExportReports,
    canUseMultiTeacher,
    canUseWhiteLabel,
    canInviteTeacher,
    getTeacherLimit,
  };
}

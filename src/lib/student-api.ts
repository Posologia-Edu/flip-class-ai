import { supabase } from "@/integrations/supabase/client";

export function getStudentToken(sessionId?: string | null): string {
  if (!sessionId) return "";
  return sessionStorage.getItem(`session_token_${sessionId}`) || "";
}

/**
 * Calls the `student-session` edge function, which validates the student's
 * HMAC session token server-side. All student reads/writes of exam attempts,
 * socratic sessions and simulation runs go through this proxy so that the
 * tables stay unreadable by anonymous clients.
 */
export async function studentApi<T = any>(
  action: string,
  sessionId: string,
  data?: Record<string, unknown>,
): Promise<T> {
  const { data: res, error } = await supabase.functions.invoke("student-session", {
    body: { action, sessionId, token: getStudentToken(sessionId), data: data || {} },
  });
  if (error) throw error;
  if ((res as any)?.error) throw new Error((res as any).error);
  return res as T;
}

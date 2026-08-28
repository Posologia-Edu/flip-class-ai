import { supabase } from "@/integrations/supabase/client";

export function getStudentToken(sessionId?: string | null): string {
  if (!sessionId) return "";
  return sessionStorage.getItem(`session_token_${sessionId}`) || "";
}

/**
 * The HMAC token lives in sessionStorage, so it disappears when the student
 * reopens the room link in a new tab or on another day. Without a token every
 * write (save_progress / submit) is rejected with 403 and answers are lost.
 * This re-issues a token for an existing session id.
 */
export async function ensureStudentToken(sessionId?: string | null, roomId?: string | null): Promise<string> {
  if (!sessionId) return "";
  const existing = getStudentToken(sessionId);
  if (existing) return existing;
  try {
    const { data, error } = await supabase.functions.invoke("student-session", {
      body: { action: "restore_token", sessionId, roomId: roomId || undefined },
    });
    if (error) return "";
    const token = (data as any)?.token || "";
    if (token) sessionStorage.setItem(`session_token_${sessionId}`, token);
    return token;
  } catch {
    return "";
  }
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

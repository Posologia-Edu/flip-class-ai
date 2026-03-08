import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "flipclass_tracking_session";

function getOrCreateSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function usePageTracking(analyticsConsented: boolean) {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!analyticsConsented) return;
    if (location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    const sessionId = getOrCreateSessionId();

    supabase.from("page_views").insert({
      session_id: sessionId,
      path: location.pathname,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
    }).then(({ error }) => {
      if (error) console.warn("Page view tracking error:", error.message);
    });
  }, [location.pathname, analyticsConsented]);
}

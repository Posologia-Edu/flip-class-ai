import { useState, useCallback, useEffect } from "react";

export type CookieCategory = "essential" | "functional" | "analytical";

export interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytical: boolean;
  timestamp: string;
}

const STORAGE_KEY = "flipclass_cookie_consent";
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function loadPreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookiePreferences;
  } catch {
    return null;
  }
}

function isExpired(prefs: CookiePreferences): boolean {
  const elapsed = Date.now() - new Date(prefs.timestamp).getTime();
  return elapsed > SIX_MONTHS_MS;
}

export function useCookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(() => {
    const saved = loadPreferences();
    if (saved && !isExpired(saved)) return saved;
    return null;
  });

  const [showBanner, setShowBanner] = useState(() => {
    const saved = loadPreferences();
    return !saved || isExpired(saved);
  });

  const updateConsent = useCallback((partial: Partial<Omit<CookiePreferences, "essential" | "timestamp">>) => {
    const newPrefs: CookiePreferences = {
      essential: true,
      functional: partial.functional ?? false,
      analytical: partial.analytical ?? false,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
    setPreferences(newPrefs);
    setShowBanner(false);
  }, []);

  const acceptAll = useCallback(() => {
    updateConsent({ functional: true, analytical: true });
  }, [updateConsent]);

  const acceptEssentialOnly = useCallback(() => {
    updateConsent({ functional: false, analytical: false });
  }, [updateConsent]);

  const hasConsent = useCallback((category: CookieCategory): boolean => {
    if (category === "essential") return true;
    return preferences?.[category] ?? false;
  }, [preferences]);

  const reopenBanner = useCallback(() => {
    setShowBanner(true);
  }, []);

  return {
    preferences,
    showBanner,
    hasConsent,
    acceptAll,
    acceptEssentialOnly,
    updateConsent,
    reopenBanner,
  };
}

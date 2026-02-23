import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isApproved: boolean;
  approvalStatus: string;
  loading: boolean;
  fullName: string;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isAdmin: false,
  isApproved: false,
  approvalStatus: "pending",
  loading: true,
  fullName: "",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    isApproved: false,
    approvalStatus: "pending",
    loading: true,
    fullName: "",
  });

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async (user: User) => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("approval_status, full_name").eq("user_id", user.id).single(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      if (cancelled) return;

      const isAdmin = rolesRes.data?.some((r: any) => r.role === "admin") ?? false;
      const approvalStatus = profileRes.data?.approval_status ?? "pending";
      const isApproved = approvalStatus === "approved" || isAdmin;

      setState({
        user,
        isAdmin,
        isApproved,
        approvalStatus,
        loading: false,
        fullName: profileRes.data?.full_name ?? "",
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState({ user: null, isAdmin: false, isApproved: false, approvalStatus: "pending", loading: false, fullName: "" });
        return;
      }
      // Use setTimeout to avoid Supabase deadlock on auth state change
      setTimeout(() => {
        if (!cancelled) loadProfile(session.user);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setState(s => ({ ...s, loading: false }));
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

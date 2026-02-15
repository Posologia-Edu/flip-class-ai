import { useEffect, useState } from "react";
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

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    isApproved: false,
    approvalStatus: "pending",
    loading: true,
    fullName: "",
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setState({ user: null, isAdmin: false, isApproved: false, approvalStatus: "pending", loading: false, fullName: "" });
        return;
      }

      const user = session.user;

      // Fetch profile and roles in parallel
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("approval_status, full_name").eq("user_id", user.id).single(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

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
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setState(s => ({ ...s, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
};

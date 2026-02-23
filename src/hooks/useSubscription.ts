import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPlanByProductId, type PlanKey } from "@/lib/subscription";

interface SubscriptionState {
  loading: boolean;
  subscribed: boolean;
  planKey: PlanKey;
  subscriptionEnd: string | null;
}

export const useSubscription = (userId: string | undefined) => {
  const [state, setState] = useState<SubscriptionState>({
    loading: true,
    subscribed: false,
    planKey: "free",
    subscriptionEnd: null,
  });

  const checkSubscription = useCallback(async () => {
    if (!userId) {
      setState({ loading: false, subscribed: false, planKey: "free", subscriptionEnd: null });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      const planKey = getPlanByProductId(data?.product_id);
      setState({
        loading: false,
        subscribed: data?.subscribed ?? false,
        planKey,
        subscriptionEnd: data?.subscription_end ?? null,
      });
    } catch {
      setState({ loading: false, subscribed: false, planKey: "free", subscriptionEnd: null });
    }
  }, [userId]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  return { ...state, refresh: checkSubscription };
};

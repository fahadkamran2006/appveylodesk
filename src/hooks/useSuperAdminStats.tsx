import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgencyStat {
  id: string;
  name: string;
  plan_tier: string;
  subscription_plan: string;
  subscription_ends_at: string | null;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  storage_percent: number;
  client_count: number;
  editor_count: number;
  revenue: number;
  is_active: boolean;
  created_at: string;
}

export interface SystemLog {
  id: string;
  event_type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SuperAdminStats {
  total_mrr: number;
  total_agencies: number;
  total_storage_used_bytes: number;
  active_agencies: number;
  churned_agencies: number;
  agencies: AgencyStat[];
  recent_logs: SystemLog[];
}

export function useSuperAdminStats() {
  return useQuery<SuperAdminStats>({
    queryKey: ["super-admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "super-admin-stats"
      );
      if (error) throw error;
      return data as SuperAdminStats;
    },
    refetchInterval: 60_000,
  });
}

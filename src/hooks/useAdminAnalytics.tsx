import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PerformanceMetrics {
  totalClientMessages: number;
  respondedMessages: number;
  replyRatePercent: number;
  avgResponseTimeSeconds: number;
  avgResponseTimeDisplay: string;
}

interface MonthlyEarnings {
  month: string;
  year: number;
  monthNum: number;
  earnings: number;
  projectsCompleted: number;
}

interface ClientAcquisition {
  month: string;
  year: number;
  monthNum: number;
  newClients: number;
}

export function useAdminAnalytics() {
  const { user } = useAuth();
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarnings[]>([]);
  const [clientAcquisition, setClientAcquisition] = useState<ClientAcquisition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get agency_id
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRoleData?.agency_id) return;

      const agencyId = userRoleData.agency_id;

      // Fetch all data in parallel
      const [metricsResult, earningsResult, clientsResult] = await Promise.all([
        supabase.rpc('get_admin_performance_metrics', { _agency_id: agencyId }),
        supabase.rpc('get_monthly_earnings', { _agency_id: agencyId, _months: 12 }),
        supabase.rpc('get_client_acquisition', { _agency_id: agencyId, _months: 12 }),
      ]);

      // Process performance metrics
      if (metricsResult.data && metricsResult.data.length > 0) {
        const metrics = metricsResult.data[0];
        setPerformanceMetrics({
          totalClientMessages: Number(metrics.total_client_messages) || 0,
          respondedMessages: Number(metrics.responded_messages) || 0,
          replyRatePercent: Number(metrics.reply_rate_percent) || 0,
          avgResponseTimeSeconds: Number(metrics.avg_response_time_seconds) || 0,
          avgResponseTimeDisplay: metrics.avg_response_time_display || 'N/A',
        });
      }

      // Process monthly earnings
      if (earningsResult.data) {
        setMonthlyEarnings(
          earningsResult.data.map((row: any) => ({
            month: row.month,
            year: row.year,
            monthNum: row.month_num,
            earnings: Number(row.earnings) || 0,
            projectsCompleted: Number(row.projects_completed) || 0,
          }))
        );
      }

      // Process client acquisition
      if (clientsResult.data) {
        setClientAcquisition(
          clientsResult.data.map((row: any) => ({
            month: row.month,
            year: row.year,
            monthNum: row.month_num,
            newClients: Number(row.new_clients) || 0,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching admin analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    performanceMetrics,
    monthlyEarnings,
    clientAcquisition,
    loading,
    refetch: fetchAnalytics,
  };
}

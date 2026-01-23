import { MessageSquare, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
interface PerformanceMetrics {
  totalClientMessages: number;
  respondedMessages: number;
  replyRatePercent: number;
  avgResponseTimeSeconds: number;
  avgResponseTimeDisplay: string;
}
interface PerformanceCardProps {
  metrics: PerformanceMetrics | null;
  loading?: boolean;
}
export function PerformanceCard({
  metrics,
  loading
}: PerformanceCardProps) {
  if (loading) {
    return <div className="glass-card rounded-xl p-6 animate-pulse">
        <div className="h-6 w-32 bg-muted/50 rounded mb-4" />
        <div className="space-y-4">
          <div className="h-16 bg-muted/50 rounded" />
          <div className="h-16 bg-muted/50 rounded" />
        </div>
      </div>;
  }
  const replyRate = metrics?.replyRatePercent || 0;
  const responseTime = metrics?.avgResponseTimeDisplay || 'N/A';

  // Determine reply rate status
  const getRateStatus = (rate: number, hasData: boolean) => {
    // If no data yet, show neutral state instead of "Needs Improvement"
    if (!hasData || metrics?.totalClientMessages === 0) {
      return {
        color: 'text-muted-foreground',
        bg: 'bg-muted',
        label: 'No Data Yet'
      };
    }
    if (rate >= 90) return {
      color: 'text-success',
      bg: 'bg-success/20',
      label: 'Excellent'
    };
    if (rate >= 70) return {
      color: 'text-warning',
      bg: 'bg-warning/20',
      label: 'Good'
    };
    return {
      color: 'text-destructive',
      bg: 'bg-destructive/20',
      label: 'Needs Improvement'
    };
  };
  const hasMetricsData = metrics !== null && metrics.totalClientMessages > 0;
  const rateStatus = getRateStatus(replyRate, hasMetricsData);
  return;
}
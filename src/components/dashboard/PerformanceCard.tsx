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

export function PerformanceCard({ metrics, loading }: PerformanceCardProps) {
  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-pulse">
        <div className="h-6 w-32 bg-muted/50 rounded mb-4" />
        <div className="space-y-4">
          <div className="h-16 bg-muted/50 rounded" />
          <div className="h-16 bg-muted/50 rounded" />
        </div>
      </div>
    );
  }

  const replyRate = metrics?.replyRatePercent || 0;
  const responseTime = metrics?.avgResponseTimeDisplay || 'N/A';

  // Determine reply rate status
  const getRateStatus = (rate: number, hasData: boolean) => {
    // If no data yet, show neutral state instead of "Needs Improvement"
    if (!hasData || (metrics?.totalClientMessages === 0)) {
      return { color: 'text-muted-foreground', bg: 'bg-muted', label: 'No Data Yet' };
    }
    if (rate >= 90) return { color: 'text-success', bg: 'bg-success/20', label: 'Excellent' };
    if (rate >= 70) return { color: 'text-warning', bg: 'bg-warning/20', label: 'Good' };
    return { color: 'text-destructive', bg: 'bg-destructive/20', label: 'Needs Improvement' };
  };

  const hasMetricsData = metrics !== null && metrics.totalClientMessages > 0;
  const rateStatus = getRateStatus(replyRate, hasMetricsData);

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Admin Performance</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reply Rate */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Reply Rate</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${rateStatus.bg} ${rateStatus.color}`}>
              {rateStatus.label}
            </span>
          </div>
          
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-foreground">{replyRate}%</span>
            <span className="text-sm text-muted-foreground mb-1">
              ({metrics?.respondedMessages || 0}/{metrics?.totalClientMessages || 0} messages)
            </span>
          </div>
          
          <Progress value={replyRate} className="h-2" />
          
          <p className="text-xs text-muted-foreground">
            Percentage of client messages that received a response
          </p>
        </div>

        {/* Average Response Time */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Avg Response Time</span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-foreground">{responseTime}</span>
            {responseTime !== 'N/A' && (
              <CheckCircle2 className="w-5 h-5 text-success" />
            )}
          </div>
          
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full bg-primary/60 rounded-full transition-all duration-500"
              style={{ 
                width: responseTime === 'N/A' ? '0%' : 
                  metrics?.avgResponseTimeSeconds && metrics.avgResponseTimeSeconds < 3600 ? '100%' :
                  metrics?.avgResponseTimeSeconds && metrics.avgResponseTimeSeconds < 86400 ? '60%' : '30%'
              }}
            />
          </div>
          
          <p className="text-xs text-muted-foreground">
            Average time to first response from admin/editor
          </p>
        </div>
      </div>
    </div>
  );
}

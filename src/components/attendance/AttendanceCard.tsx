import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckoutModal } from './CheckoutModal';
import { LogIn, LogOut, Clock, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceCardProps {
  employmentType: 'salaried' | 'freelance';
  agencyId: string;
}

interface DailyLog {
  id: string;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  work_summary: string | null;
  log_type: string;
  created_at: string;
}

export function AttendanceCard({ employmentType, agencyId }: AttendanceCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [taskSummary, setTaskSummary] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const today = new Date().toISOString().split('T')[0];

  const fetchTodayLog = useCallback(async () => {
    if (!user) return;
    try {
      const logType = employmentType === 'salaried' ? 'attendance' : 'task_update';
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('editor_id', user.id)
        .eq('date', today)
        .eq('log_type', logType)
        .maybeSingle();

      if (error) throw error;
      setTodayLog(data as DailyLog | null);
    } catch (error) {
      console.error('Error fetching today log:', error);
    } finally {
      setLoading(false);
    }
  }, [user, today, employmentType]);

  useEffect(() => {
    fetchTodayLog();
  }, [fetchTodayLog]);

  // Elapsed timer for salaried check-in
  useEffect(() => {
    if (employmentType !== 'salaried' || !todayLog?.check_in_at || todayLog?.check_out_at) return;

    const updateElapsed = () => {
      const start = new Date(todayLog.check_in_at!).getTime();
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [todayLog, employmentType]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('daily_logs').insert({
        editor_id: user.id,
        agency_id: agencyId,
        date: today,
        check_in_at: new Date().toISOString(),
        log_type: 'attendance',
      });
      if (error) throw error;
      toast({ title: 'Checked In', description: 'Your shift has started. Have a productive day!' });
      fetchTodayLog();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutConfirm = async (workSummary: string) => {
    if (!user || !todayLog) return;
    try {
      const { error } = await supabase
        .from('daily_logs')
        .update({
          check_out_at: new Date().toISOString(),
          work_summary: workSummary,
        })
        .eq('id', todayLog.id);
      if (error) throw error;
      toast({ title: 'Checked Out', description: 'Your shift has been recorded.' });
      setCheckoutOpen(false);
      fetchTodayLog();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const handleSubmitTaskLog = async () => {
    if (!user || !taskSummary.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('daily_logs').insert({
        editor_id: user.id,
        agency_id: agencyId,
        date: today,
        work_summary: taskSummary.trim(),
        log_type: 'task_update',
      });
      if (error) throw error;
      toast({ title: 'Task Log Submitted', description: 'Your daily work has been recorded.' });
      setTaskSummary('');
      fetchTodayLog();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // SALARIED FLOW
  if (employmentType === 'salaried') {
    const isCheckedIn = todayLog?.check_in_at && !todayLog?.check_out_at;
    const isCheckedOut = todayLog?.check_in_at && todayLog?.check_out_at;

    return (
      <>
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                isCheckedIn ? "bg-success/10" : isCheckedOut ? "bg-primary/10" : "bg-muted"
              )}>
                {isCheckedOut ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : isCheckedIn ? (
                  <Clock className="w-5 h-5 text-success animate-pulse" />
                ) : (
                  <LogIn className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Attendance</h3>
                <p className="text-xs text-muted-foreground">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>

            {isCheckedIn && (
              <div className="text-right">
                <p className="text-2xl font-mono font-bold text-success">{formatTime(elapsedSeconds)}</p>
                <p className="text-xs text-muted-foreground">Elapsed</p>
              </div>
            )}
          </div>

          {isCheckedOut ? (
            <div className="rounded-lg bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Check In</span>
                <span className="text-foreground">{new Date(todayLog!.check_in_at!).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Check Out</span>
                <span className="text-foreground">{new Date(todayLog!.check_out_at!).toLocaleTimeString()}</span>
              </div>
              {todayLog?.work_summary && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Work Summary</p>
                  <p className="text-sm text-foreground">{todayLog.work_summary}</p>
                </div>
              )}
            </div>
          ) : isCheckedIn ? (
            <Button
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => setCheckoutOpen(true)}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Check Out
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={handleCheckIn}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              Check In
            </Button>
          )}
        </div>

        <CheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          onConfirm={handleCheckoutConfirm}
          checkInTime={todayLog?.check_in_at || ''}
        />
      </>
    );
  }

  // FREELANCE FLOW
  const hasSubmittedToday = !!todayLog;

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          hasSubmittedToday ? "bg-success/10" : "bg-muted"
        )}>
          {hasSubmittedToday ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : (
            <FileText className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Daily Task Log</h3>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {hasSubmittedToday ? (
        <div className="rounded-lg bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground mb-1">Today's Summary</p>
          <p className="text-sm text-foreground">{todayLog.work_summary}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            placeholder="What did you work on today? List tasks completed, progress made..."
            value={taskSummary}
            onChange={(e) => setTaskSummary(e.target.value)}
            className="bg-surface-elevated border-border/50 min-h-[100px]"
          />
          <Button
            className="w-full"
            onClick={handleSubmitTaskLog}
            disabled={submitting || !taskSummary.trim()}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Submit Daily Log
          </Button>
        </div>
      )}
    </div>
  );
}

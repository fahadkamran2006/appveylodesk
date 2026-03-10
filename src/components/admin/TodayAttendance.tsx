import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogIn, Clock, AlertTriangle, XCircle, Palmtree, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorAttendance {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  employment_type: string;
  checkIn: string | null;
  checkOut: string | null;
  status: 'checked-in' | 'checked-out' | 'late' | 'absent' | 'leave';
}

interface TodayAttendanceProps {
  agencyId: string;
  teamMembers: Array<{
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    employment_type: string;
  }>;
}

export function TodayAttendance({ agencyId, teamMembers }: TodayAttendanceProps) {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<EditorAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [lateThresholdHour, setLateThresholdHour] = useState(10);
  const [lateThresholdMinute, setLateThresholdMinute] = useState(0);

  useEffect(() => {
    if (!agencyId || teamMembers.length === 0) {
      setLoading(false);
      return;
    }

    const fetchToday = async () => {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Fetch today's logs, approved leaves covering today, and work schedule
      const [logsRes, leavesRes, scheduleRes] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('agency_id', agencyId)
          .eq('date', today)
          .eq('log_type', 'attendance'),
        supabase
          .from('leave_requests')
          .select('*')
          .eq('agency_id', agencyId)
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today),
        supabase
          .from('agency_work_schedule' as any)
          .select('*')
          .eq('agency_id', agencyId)
          .maybeSingle(),
      ]);

      const logs = (logsRes.data || []) as any[];
      const leaves = (leavesRes.data || []) as any[];

      let localLateHour = 10;
      let localLateMin = 0;
      if (scheduleRes.data) {
        localLateHour = (scheduleRes.data as any).late_threshold_hour ?? 10;
        localLateMin = (scheduleRes.data as any).late_threshold_minute ?? 0;
        setLateThresholdHour(localLateHour);
        setLateThresholdMinute(localLateMin);
      }

      const thresholdTotal = localLateHour * 60 + localLateMin;
      const logMap = new Map(logs.map(l => [l.editor_id, l]));
      const leaveEditorIds = new Set(leaves.map((l: any) => l.editor_id));

      const result: EditorAttendance[] = teamMembers.map(m => {
        const log = logMap.get(m.id);
        const onLeave = leaveEditorIds.has(m.id);

        if (onLeave) {
          return { ...m, checkIn: null, checkOut: null, status: 'leave' as const };
        }

        if (log?.check_in_at) {
          const checkInTime = new Date(log.check_in_at);
          const checkInTotal = checkInTime.getHours() * 60 + checkInTime.getMinutes();
          const isLate = checkInTotal > thresholdTotal;

          if (log.check_out_at) {
            return {
              ...m,
              checkIn: log.check_in_at,
              checkOut: log.check_out_at,
              status: 'checked-out' as const,
            };
          }

          return {
            ...m,
            checkIn: log.check_in_at,
            checkOut: null,
            status: isLate ? 'late' : 'checked-in',
          };
        }

        return { ...m, checkIn: null, checkOut: null, status: 'absent' as const };
      });

      // Sort: late first, then absent, then checked-in, then leave, then checked-out
      const order = { late: 0, absent: 1, 'checked-in': 2, leave: 3, 'checked-out': 4 };
      result.sort((a, b) => order[a.status] - order[b.status]);

      setAttendance(result);
      setLoading(false);
    };

    fetchToday();
  }, [agencyId, teamMembers]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (attendance.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No editors in team yet.</p>;
  }

  const checkedIn = attendance.filter(a => a.status === 'checked-in' || a.status === 'late').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const onLeave = attendance.filter(a => a.status === 'leave').length;
  const late = attendance.filter(a => a.status === 'late').length;

  const statusConfig = {
    'checked-in': { label: 'Active', icon: LogIn, color: 'bg-success/10 text-success border-success/20' },
    'checked-out': { label: 'Done', icon: Clock, color: 'bg-muted text-muted-foreground border-border' },
    late: { label: 'Late', icon: AlertTriangle, color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
    absent: { label: 'Absent', icon: XCircle, color: 'bg-destructive/10 text-destructive border-destructive/20' },
    leave: { label: 'On Leave', icon: Palmtree, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  };

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-success/10 p-2 text-center">
          <p className="text-lg font-bold text-success">{checkedIn}</p>
          <p className="text-[10px] text-muted-foreground">Active</p>
        </div>
        <div className="rounded-lg bg-destructive/10 p-2 text-center">
          <p className="text-lg font-bold text-destructive">{absent}</p>
          <p className="text-[10px] text-muted-foreground">Absent</p>
        </div>
        <div className="rounded-lg bg-orange-500/10 p-2 text-center">
          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{late}</p>
          <p className="text-[10px] text-muted-foreground">Late</p>
        </div>
        <div className="rounded-lg bg-blue-500/10 p-2 text-center">
          <p className="text-lg font-bold text-blue-500">{onLeave}</p>
          <p className="text-[10px] text-muted-foreground">Leave</p>
        </div>
      </div>

      {/* Editor list */}
      <div className="space-y-2">
        {attendance.map(editor => {
          const config = statusConfig[editor.status];
          const StatusIcon = config.icon;
          const initials = editor.full_name
            ? editor.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            : editor.email.slice(0, 2).toUpperCase();

          return (
            <div
              key={editor.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/20 transition-colors group cursor-pointer"
              onClick={() => navigate(`/admin/team/${editor.id}`)}
            >
              <Avatar className="w-9 h-9 border border-border/30">
                <AvatarImage src={editor.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {editor.full_name || editor.email}
                </p>
                {editor.checkIn && (
                  <p className="text-[11px] text-muted-foreground">
                    In: {new Date(editor.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {editor.checkOut && ` — Out: ${new Date(editor.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                )}
              </div>

              <Badge variant="secondary" className={cn('text-[10px] border shrink-0', config.color)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>

              <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

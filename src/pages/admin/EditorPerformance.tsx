import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Linkify } from '@/lib/linkify';
import { exportToCSV } from '@/lib/exportData';
import {
  ArrowLeft,
  Briefcase,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FolderKanban,
  Loader2,
  LogIn,
  CalendarDays,
  XCircle,
  Mail,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  employment_type: 'salaried' | 'freelance';
  monthly_salary: number | null;
  created_at: string;
}

interface DailyLog {
  id: string;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  work_summary: string | null;
  log_type: string;
}

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: string;
  admin_note: string | null;
  created_at: string;
}

interface ProjectInfo {
  id: string;
  title: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  done: 'bg-success/10 text-success border-success/20',
  in_progress: 'bg-primary/10 text-primary border-primary/20',
  review: 'bg-warning/10 text-warning border-warning/20',
  backlog: 'bg-muted text-muted-foreground border-border',
  proposal: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function EditorPerformancePage() {
  const { editorId } = useParams<{ editorId: string }>();
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [editor, setEditor] = useState<EditorProfile | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [lateThresholdHour, setLateThresholdHour] = useState(10);
  const [lateThresholdMinute, setLateThresholdMinute] = useState(0);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'admin')) {
      navigate('/auth/login');
    }
  }, [user, userRole, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    if (!user || !editorId) return;
    setLoading(true);
    try {
      // Get admin's agency
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!roleData?.agency_id) return;
      const aid = roleData.agency_id;
      setAgencyId(aid);

      // Fetch editor profile, logs, leaves, project assignments, and work schedule in parallel
      const [profileRes, logsRes, leavesRes, assignmentsRes, scheduleRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, employment_type, monthly_salary, created_at')
          .eq('id', editorId)
          .maybeSingle(),
        supabase
          .from('daily_logs')
          .select('*')
          .eq('editor_id', editorId)
          .eq('agency_id', aid)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),
        supabase
          .from('leave_requests')
          .select('*')
          .eq('editor_id', editorId)
          .eq('agency_id', aid)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_editors')
          .select('project_id')
          .eq('editor_id', editorId),
        supabase
          .from('agency_work_schedule' as any)
          .select('*')
          .eq('agency_id', aid)
          .maybeSingle(),
      ]);

      setEditor(profileRes.data as EditorProfile | null);
      setLogs((logsRes.data || []) as DailyLog[]);
      setLeaves((leavesRes.data || []) as LeaveRequest[]);

      // Apply work schedule config
      if (scheduleRes.data) {
        const sched = scheduleRes.data as any;
        setWorkingDays(sched.working_days || [1, 2, 3, 4, 5]);
        setLateThresholdHour(sched.late_threshold_hour ?? 10);
        setLateThresholdMinute(sched.late_threshold_minute ?? 0);
      }

      // Fetch project details
      if (assignmentsRes.data && assignmentsRes.data.length > 0) {
        const projectIds = assignmentsRes.data.map(a => a.project_id);
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, title, status, completed_at, created_at')
          .in('id', projectIds)
          .eq('agency_id', aid)
          .order('created_at', { ascending: false });
        setProjects((projectData || []) as ProjectInfo[]);
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.error('Error fetching editor data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, editorId, startDate, endDate]);

  useEffect(() => {
    if (user && userRole === 'admin') fetchData();
  }, [fetchData, user, userRole]);

  const attendanceLogs = useMemo(() => logs.filter(l => l.log_type === 'attendance'), [logs]);
  const taskLogs = useMemo(() => logs.filter(l => l.log_type === 'task_update'), [logs]);
  const totalDaysPresent = attendanceLogs.filter(l => l.check_in_at).length;
  const totalHoursMs = attendanceLogs.reduce((sum, l) => {
    if (l.check_in_at && l.check_out_at) {
      return sum + (new Date(l.check_out_at).getTime() - new Date(l.check_in_at).getTime());
    }
    return sum;
  }, 0);
  const totalHours = Math.round(totalHoursMs / 3600000 * 10) / 10;
  const approvedLeaves = leaves.filter(l => l.status === 'approved').length;
  const completedProjects = projects.filter(p => p.status === 'done').length;
  const activeProjects = projects.filter(p => ['in_progress', 'review', 'backlog'].includes(p.status)).length;

  const formatHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return '-';
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  // Late arrival tracking (check-in after 10:00 AM local)
  const LATE_THRESHOLD_HOUR = 10;
  const lateArrivals = useMemo(() => {
    return attendanceLogs.filter(l => {
      if (!l.check_in_at) return false;
      const checkInHour = new Date(l.check_in_at).getHours();
      const checkInMin = new Date(l.check_in_at).getMinutes();
      return checkInHour > LATE_THRESHOLD_HOUR || (checkInHour === LATE_THRESHOLD_HOUR && checkInMin > 0);
    });
  }, [attendanceLogs]);

  const avgDeliveryDays = useMemo(() => {
    const completed = projects.filter(p => p.status === 'done' && p.completed_at);
    if (completed.length === 0) return null;
    const totalDays = completed.reduce((sum, p) => {
      const diff = new Date(p.completed_at!).getTime() - new Date(p.created_at).getTime();
      return sum + diff / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round((totalDays / completed.length) * 10) / 10;
  }, [projects]);

  // Build heatmap data
  const heatmapData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days: Array<{
      date: string;
      dayOfWeek: number;
      status: 'present' | 'late' | 'absent' | 'leave' | 'weekend' | 'future';
      checkIn?: string;
      hours?: string;
    }> = [];

    const attendanceMap = new Map<string, DailyLog>();
    attendanceLogs.forEach(l => attendanceMap.set(l.date, l));

    const leaveDates = new Set<string>();
    leaves.filter(l => l.status === 'approved').forEach(l => {
      const ls = new Date(l.start_date);
      const le = new Date(l.end_date);
      for (let d = new Date(ls); d <= le; d.setDate(d.getDate() + 1)) {
        leaveDates.add(d.toISOString().split('T')[0]);
      }
    });

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();

      if (d > today) {
        days.push({ date: dateStr, dayOfWeek, status: 'future' });
        continue;
      }

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        days.push({ date: dateStr, dayOfWeek, status: 'weekend' });
        continue;
      }

      if (leaveDates.has(dateStr)) {
        days.push({ date: dateStr, dayOfWeek, status: 'leave' });
        continue;
      }

      const log = attendanceMap.get(dateStr);
      if (log?.check_in_at) {
        const checkInTime = new Date(log.check_in_at);
        const isLate = checkInTime.getHours() > LATE_THRESHOLD_HOUR || 
          (checkInTime.getHours() === LATE_THRESHOLD_HOUR && checkInTime.getMinutes() > 0);
        days.push({
          date: dateStr,
          dayOfWeek,
          status: isLate ? 'late' : 'present',
          checkIn: checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hours: formatHours(log.check_in_at, log.check_out_at),
        });
      } else {
        days.push({ date: dateStr, dayOfWeek, status: 'absent' });
      }
    }
    return days;
  }, [startDate, endDate, attendanceLogs, leaves, formatHours]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success border-success/20';
      case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const handleExportAttendance = () => {
    const rows = logs.map(l => ({
      Date: l.date,
      Type: l.log_type,
      'Check In': l.check_in_at ? new Date(l.check_in_at).toLocaleTimeString() : '',
      'Check Out': l.check_out_at ? new Date(l.check_out_at).toLocaleTimeString() : '',
      Hours: formatHours(l.check_in_at, l.check_out_at),
      'Work Summary': l.work_summary || '',
    }));
    exportToCSV(rows, `${editor?.full_name || 'editor'}-attendance-${startDate}-to-${endDate}`);
  };

  const handleExportLeaves = () => {
    const rows = leaves.map(l => ({
      'Start Date': l.start_date,
      'End Date': l.end_date,
      Type: l.leave_type,
      Status: l.status,
      Reason: l.reason,
      'Admin Note': l.admin_note || '',
      Submitted: new Date(l.created_at).toLocaleDateString(),
    }));
    exportToCSV(rows, `${editor?.full_name || 'editor'}-leaves`);
  };

  const handleExportProjects = () => {
    const rows = projects.map(p => ({
      Title: p.title,
      Status: p.status,
      Created: new Date(p.created_at).toLocaleDateString(),
      Completed: p.completed_at ? new Date(p.completed_at).toLocaleDateString() : '',
    }));
    exportToCSV(rows, `${editor?.full_name || 'editor'}-projects`);
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!editor) {
    return (
      <DashboardLayout role="admin">
        <div className="text-center py-16 text-muted-foreground">Editor not found.</div>
      </DashboardLayout>
    );
  }

  const initials = editor.full_name
    ? editor.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : editor.email.slice(0, 2).toUpperCase();

  return (
    <>
      <Helmet>
        <title>{editor.full_name || 'Editor'} Performance | Veylodesk</title>
        <meta name="description" content={`Performance analytics for ${editor.full_name || 'editor'}`} />
      </Helmet>

      <DashboardLayout role="admin">
        <div className="max-w-6xl mx-auto">
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/team')} className="mb-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Team
          </Button>

          {/* Editor Header */}
          <div className="glass-card rounded-xl p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Avatar className="w-16 h-16 border-2 border-border/50">
                <AvatarImage src={editor.avatar_url || undefined} alt={editor.full_name || ''} />
                <AvatarFallback className="bg-primary/20 text-primary text-xl font-medium">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-foreground">{editor.full_name || 'Unnamed Editor'}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> {editor.email}
                  </span>
                  <Badge variant="outline" className={cn('text-xs', editor.employment_type === 'salaried' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border')}>
                    <Briefcase className="w-3 h-3 mr-1" />
                    {editor.employment_type === 'salaried' ? 'Salaried' : 'Freelance'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Joined {new Date(editor.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <StatCard icon={<FolderKanban className="w-5 h-5 text-primary" />} value={activeProjects} label="Active Projects" bg="bg-primary/10" />
            <StatCard icon={<CheckCircle2 className="w-5 h-5 text-success" />} value={completedProjects} label="Completed" bg="bg-success/10" />
            <StatCard icon={<LogIn className="w-5 h-5 text-primary" />} value={totalDaysPresent} label="Days Present" bg="bg-primary/10" />
            <StatCard icon={<Clock className="w-5 h-5 text-success" />} value={`${totalHours}h`} label="Total Hours" bg="bg-success/10" />
            <StatCard icon={<FileText className="w-5 h-5 text-warning" />} value={taskLogs.length} label="Task Logs" bg="bg-warning/10" />
            <StatCard icon={<CalendarDays className="w-5 h-5 text-destructive" />} value={approvedLeaves} label="Leaves Taken" bg="bg-destructive/10" />
            <StatCard icon={<AlertTriangle className="w-5 h-5 text-orange-500" />} value={lateArrivals.length} label="Late Arrivals" bg="bg-orange-500/10" />
          </div>

          {avgDeliveryDays !== null && (
            <div className="glass-card rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Delivery Time</p>
                <p className="text-lg font-bold text-foreground">
                  {avgDeliveryDays < 1 ? `${Math.round(avgDeliveryDays * 24)} hours` : `${avgDeliveryDays} days`}
                </p>
              </div>
            </div>
          )}

          {/* Date filter */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 h-9 text-sm" />
            </div>
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 h-9 text-sm" />
          </div>

          {/* Attendance Heatmap */}
          {editor.employment_type === 'salaried' && heatmapData.length > 0 && (
            <div className="glass-card rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Attendance Heatmap</h3>
              
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-success" /> Present</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-500" /> Late</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-destructive" /> Absent</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-500" /> Leave</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-muted" /> Weekend</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-border bg-background" /> Future</div>
              </div>

              {/* Day labels */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="text-center text-[10px] text-muted-foreground font-medium">{d}</div>
                ))}
              </div>

              {/* Heatmap grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Pad first row */}
                {heatmapData.length > 0 && (() => {
                  const firstDay = heatmapData[0].dayOfWeek;
                  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0
                  return Array.from({ length: offset }).map((_, i) => (
                    <div key={`pad-${i}`} className="aspect-square" />
                  ));
                })()}
                {heatmapData.map((day) => {
                  const bgColor = {
                    present: 'bg-success hover:bg-success/80',
                    late: 'bg-orange-500 hover:bg-orange-500/80',
                    absent: 'bg-destructive/80 hover:bg-destructive/60',
                    leave: 'bg-blue-500 hover:bg-blue-500/80',
                    weekend: 'bg-muted hover:bg-muted/80',
                    future: 'bg-background border border-border/50',
                  }[day.status];

                  const tooltip = day.status === 'present' ? `✅ ${day.date} — In: ${day.checkIn} — ${day.hours}`
                    : day.status === 'late' ? `⚠️ Late: ${day.date} — In: ${day.checkIn} — ${day.hours}`
                    : day.status === 'absent' ? `❌ Absent: ${day.date}`
                    : day.status === 'leave' ? `🏖️ On Leave: ${day.date}`
                    : day.status === 'weekend' ? `Weekend: ${day.date}`
                    : day.date;

                  return (
                    <div
                      key={day.date}
                      title={tooltip}
                      className={cn(
                        'aspect-square rounded-sm flex items-center justify-center cursor-default transition-colors text-[9px] font-medium',
                        bgColor,
                        day.status === 'present' || day.status === 'late' ? 'text-white' : '',
                        day.status === 'absent' ? 'text-white' : '',
                        day.status === 'leave' ? 'text-white' : '',
                      )}
                    >
                      {new Date(day.date).getDate()}
                    </div>
                  );
                })}
              </div>

              {/* Late arrivals summary */}
              {lateArrivals.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Late Arrivals ({lateArrivals.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lateArrivals.slice(0, 10).map(l => (
                      <Badge key={l.id} variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                        {new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' — '}
                        {new Date(l.check_in_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Badge>
                    ))}
                    {lateArrivals.length > 10 && (
                      <span className="text-[10px] text-muted-foreground">+{lateArrivals.length - 10} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="attendance" className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="attendance" className="flex-1 text-sm">Attendance & Tasks ({logs.length})</TabsTrigger>
              <TabsTrigger value="leaves" className="flex-1 text-sm">Leaves ({leaves.length})</TabsTrigger>
              <TabsTrigger value="projects" className="flex-1 text-sm">Projects ({projects.length})</TabsTrigger>
            </TabsList>

            {/* Attendance Tab */}
            <TabsContent value="attendance">
              <div className="flex justify-end mb-3">
                <Button variant="outline" size="sm" onClick={handleExportAttendance} disabled={logs.length === 0}>
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No records found for this period.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/50">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                        {editor.employment_type === 'salaried' && (
                          <>
                            <th className="text-left p-3 font-medium text-muted-foreground">Check In</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Check Out</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Hours</th>
                          </>
                        )}
                        <th className="text-left p-3 font-medium text-muted-foreground">Work Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/10">
                          <td className="p-3 text-foreground whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary" className="text-xs">
                              {log.log_type === 'attendance' ? 'Attendance' : 'Task'}
                            </Badge>
                          </td>
                          {editor.employment_type === 'salaried' && (
                            <>
                              <td className="p-3 text-foreground">
                                {log.check_in_at ? new Date(log.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                              <td className="p-3 text-foreground">
                                {log.check_out_at ? new Date(log.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                                  log.check_in_at ? <Badge variant="secondary" className="bg-warning/10 text-warning text-xs border border-warning/20">Active</Badge> : '-'
                                )}
                              </td>
                              <td className="p-3 text-foreground">{formatHours(log.check_in_at, log.check_out_at)}</td>
                            </>
                          )}
                          <td className="p-3 text-muted-foreground max-w-[400px]">
                            {log.work_summary ? <Linkify text={log.work_summary} /> : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Leaves Tab */}
            <TabsContent value="leaves">
              <div className="flex justify-end mb-3">
                <Button variant="outline" size="sm" onClick={handleExportLeaves} disabled={leaves.length === 0}>
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
              {leaves.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No leave requests found.</div>
              ) : (
                <div className="space-y-3">
                  {leaves.map((leave) => (
                    <div key={leave.id} className="glass-card rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground capitalize">{leave.leave_type} Leave</span>
                            <Badge variant="secondary" className={cn('text-xs border', statusColor(leave.status))}>{leave.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {new Date(leave.start_date).toLocaleDateString()} — {new Date(leave.end_date).toLocaleDateString()}
                            {' • '}
                            {Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} day(s)
                          </p>
                          <p className="text-sm text-foreground">{leave.reason}</p>
                          {leave.admin_note && (
                            <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-2">Admin: {leave.admin_note}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {leave.status === 'approved' ? <CheckCircle2 className="w-5 h-5 text-success" /> :
                           leave.status === 'rejected' ? <XCircle className="w-5 h-5 text-destructive" /> :
                           <Clock className="w-5 h-5 text-warning" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects">
              <div className="flex justify-end mb-3">
                <Button variant="outline" size="sm" onClick={handleExportProjects} disabled={projects.length === 0}>
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
              {projects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No projects assigned yet.</div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div key={project.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{project.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Created {new Date(project.created_at).toLocaleDateString()}
                          {project.completed_at && ` • Completed ${new Date(project.completed_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Badge variant="secondary" className={cn('text-xs border', STATUS_COLORS[project.status] || 'bg-muted text-muted-foreground border-border')}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </>
  );
}

function StatCard({ icon, value, label, bg }: { icon: React.ReactNode; value: string | number; label: string; bg: string }) {
  return (
    <div className="glass-card rounded-xl p-4 text-center">
      <div className={cn('w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center', bg)}>
        {icon}
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Linkify } from '@/lib/linkify';
import { exportToCSV } from '@/lib/exportData';
import {
  Calendar as CalendarIcon,
  Clock,
  FileText,
  CalendarDays,
  Download,
  Loader2,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function CalendarPage() {
  const { user, userRole } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState('');
  const [employmentType, setEmploymentType] = useState<'salaried' | 'freelance'>('freelance');

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('employment_type').eq('id', user.id).maybeSingle(),
        supabase.from('user_roles').select('agency_id').eq('user_id', user.id).maybeSingle(),
      ]);

      const empType = (profileRes.data?.employment_type as 'salaried' | 'freelance') || 'freelance';
      setEmploymentType(empType);
      const aid = roleRes.data?.agency_id || '';
      setAgencyId(aid);

      const [logsRes, leavesRes] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('editor_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),
        supabase
          .from('leave_requests')
          .select('*')
          .eq('editor_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      setLogs((logsRes.data || []) as DailyLog[]);
      setLeaves((leavesRes.data || []) as LeaveRequest[]);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stats
  const attendanceLogs = logs.filter(l => l.log_type === 'attendance');
  const taskLogs = logs.filter(l => l.log_type === 'task_update');
  const totalDaysPresent = attendanceLogs.filter(l => l.check_in_at).length;
  const totalHoursMs = attendanceLogs.reduce((sum, l) => {
    if (l.check_in_at && l.check_out_at) {
      return sum + (new Date(l.check_out_at).getTime() - new Date(l.check_in_at).getTime());
    }
    return sum;
  }, 0);
  const totalHours = Math.round(totalHoursMs / 3600000 * 10) / 10;
  const avgHours = totalDaysPresent > 0 ? Math.round((totalHours / totalDaysPresent) * 10) / 10 : 0;
  const approvedLeaves = leaves.filter(l => l.status === 'approved').length;
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;

  const formatHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return '-';
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

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
    exportToCSV(rows, `attendance-${startDate}-to-${endDate}`);
  };

  const handleExportLeaves = () => {
    const rows = leaves.map(l => ({
      'Start Date': l.start_date,
      'End Date': l.end_date,
      Type: l.leave_type,
      Status: l.status,
      Reason: l.reason,
      'Admin Note': l.admin_note || '',
      'Submitted': new Date(l.created_at).toLocaleDateString(),
    }));
    exportToCSV(rows, `leaves-export`);
  };

  return (
    <>
      <Helmet>
        <title>Calendar | Veylodesk</title>
        <meta name="description" content="View your attendance, task logs, and leave history" />
      </Helmet>

      <DashboardLayout role={(userRole as 'admin' | 'client' | 'editor') || 'editor'}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Calendar & Activity</h1>
            <p className="text-muted-foreground mt-1">Track your attendance, work logs, and leaves</p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-primary/10 flex items-center justify-center">
                <LogIn className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">{totalDaysPresent}</p>
              <p className="text-xs text-muted-foreground">Days Present</p>
            </div>
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-success/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-success" />
              </div>
              <p className="text-xl font-bold text-foreground">{totalHours}h</p>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-warning/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-warning" />
              </div>
              <p className="text-xl font-bold text-foreground">{taskLogs.length}</p>
              <p className="text-xs text-muted-foreground">Task Logs</p>
            </div>
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-destructive/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-xl font-bold text-foreground">{approvedLeaves}</p>
              <p className="text-xs text-muted-foreground">Leaves Taken</p>
            </div>
          </div>

          {/* Date filter */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 h-9 text-sm" />
            </div>
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 h-9 text-sm" />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="attendance" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="attendance" className="flex-1 text-sm">Attendance & Tasks</TabsTrigger>
                <TabsTrigger value="leaves" className="flex-1 text-sm">Leaves ({leaves.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="attendance">
                <div className="flex justify-end mb-3">
                  <Button variant="outline" size="sm" onClick={handleExportAttendance} disabled={logs.length === 0}>
                    <Download className="w-4 h-4 mr-1" />
                    Export CSV
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
                          {employmentType === 'salaried' && (
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
                            {employmentType === 'salaried' && (
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

              <TabsContent value="leaves">
                <div className="flex justify-end mb-3">
                  <Button variant="outline" size="sm" onClick={handleExportLeaves} disabled={leaves.length === 0}>
                    <Download className="w-4 h-4 mr-1" />
                    Export CSV
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
                              <Badge variant="secondary" className={cn("text-xs border", statusColor(leave.status))}>
                                {leave.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {new Date(leave.start_date).toLocaleDateString()} — {new Date(leave.end_date).toLocaleDateString()}
                              {' • '}
                              {Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} day(s)
                            </p>
                            <p className="text-sm text-foreground">{leave.reason}</p>
                            {leave.admin_note && (
                              <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-2">
                                Admin: {leave.admin_note}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            {leave.status === 'approved' ? (
                              <CheckCircle2 className="w-5 h-5 text-success" />
                            ) : leave.status === 'rejected' ? (
                              <XCircle className="w-5 h-5 text-destructive" />
                            ) : (
                              <Clock className="w-5 h-5 text-warning" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}

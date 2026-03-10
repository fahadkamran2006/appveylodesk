import { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/lib/exportData';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  FolderKanban,
  Receipt,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  CalendarDays,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityEvent {
  id: string;
  date: string;
  type: 'project_created' | 'status_change' | 'deliverable' | 'invoice_sent' | 'invoice_paid' | 'leave' | 'task_log' | 'attendance';
  title: string;
  detail?: string;
  color: string;
  icon: React.ElementType;
  link?: string;
}

export default function CalendarPage() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = useMemo(() => new Date(year, month, 1), [year, month]);
  const lastDay = useMemo(() => new Date(year, month + 1, 0), [year, month]);
  const startDateStr = firstDay.toISOString().split('T')[0];
  const endDateStr = lastDay.toISOString().split('T')[0];

  const fetchEvents = useCallback(async () => {
    if (!user || !userRole) return;
    setLoading(true);
    const allEvents: ActivityEvent[] = [];

    try {
      const roleRes = await supabase.from('user_roles').select('agency_id').eq('user_id', user.id).maybeSingle();
      const agencyId = roleRes.data?.agency_id;
      if (!agencyId) { setLoading(false); return; }

      const rolePrefix = userRole === 'admin' ? '/admin' : userRole === 'client' ? '/client' : '/editor';

      if (userRole === 'admin') {
        const [projectsRes, invoicesRes, deliverablesRes] = await Promise.all([
          supabase.from('projects').select('id,title,status,created_at,completed_at,due_date').eq('agency_id', agencyId),
          supabase.from('invoices').select('id,amount,status,created_at,paid_at').eq('agency_id', agencyId),
          supabase.from('deliverables').select('id,file_name,created_at,project_id').order('created_at', { ascending: false }),
        ]);

        (projectsRes.data || []).forEach(p => {
          const createdDate = p.created_at.split('T')[0];
          if (createdDate >= startDateStr && createdDate <= endDateStr) {
            allEvents.push({ id: `p-${p.id}`, date: createdDate, type: 'project_created', title: `Project created: ${p.title}`, color: 'text-primary', icon: FolderKanban, link: `${rolePrefix}/projects` });
          }
          if (p.completed_at) {
            const doneDate = p.completed_at.split('T')[0];
            if (doneDate >= startDateStr && doneDate <= endDateStr) {
              allEvents.push({ id: `pd-${p.id}`, date: doneDate, type: 'status_change', title: `Delivered: ${p.title}`, color: 'text-success', icon: CheckCircle2, link: `${rolePrefix}/projects` });
            }
          }
        });

        (invoicesRes.data || []).forEach(i => {
          const sentDate = i.created_at.split('T')[0];
          if (sentDate >= startDateStr && sentDate <= endDateStr) {
            allEvents.push({ id: `is-${i.id}`, date: sentDate, type: 'invoice_sent', title: `Invoice sent: $${i.amount}`, color: 'text-warning', icon: Receipt, link: `/invoices/${i.id}` });
          }
          if (i.paid_at) {
            const paidDate = i.paid_at.split('T')[0];
            if (paidDate >= startDateStr && paidDate <= endDateStr) {
              allEvents.push({ id: `ip-${i.id}`, date: paidDate, type: 'invoice_paid', title: `Invoice paid: $${i.amount}`, color: 'text-success', icon: Receipt, link: `/invoices/${i.id}` });
            }
          }
        });

        (deliverablesRes.data || []).forEach(d => {
          const date = d.created_at.split('T')[0];
          if (date >= startDateStr && date <= endDateStr) {
            allEvents.push({ id: `d-${d.id}`, date, type: 'deliverable', title: `Uploaded: ${d.file_name}`, color: 'text-primary', icon: Upload, link: `${rolePrefix}/projects` });
          }
        });

      } else if (userRole === 'client') {
        const [projectsRes, invoicesRes, deliverablesRes] = await Promise.all([
          supabase.from('projects').select('id,title,status,created_at,completed_at,due_date').eq('client_id', user.id),
          supabase.from('invoices').select('id,amount,status,created_at,paid_at').eq('client_id', user.id),
          supabase.from('deliverables').select('id,file_name,created_at,project_id').order('created_at', { ascending: false }),
        ]);

        (projectsRes.data || []).forEach(p => {
          const createdDate = p.created_at.split('T')[0];
          if (createdDate >= startDateStr && createdDate <= endDateStr) {
            allEvents.push({ id: `p-${p.id}`, date: createdDate, type: 'project_created', title: `Requested: ${p.title}`, color: 'text-primary', icon: FolderKanban, link: `${rolePrefix}/projects` });
          }
          if (p.completed_at) {
            const doneDate = p.completed_at.split('T')[0];
            if (doneDate >= startDateStr && doneDate <= endDateStr) {
              allEvents.push({ id: `pd-${p.id}`, date: doneDate, type: 'status_change', title: `Delivered: ${p.title}`, color: 'text-success', icon: CheckCircle2, link: `${rolePrefix}/projects` });
            }
          }
        });

        (invoicesRes.data || []).forEach(i => {
          const sentDate = i.created_at.split('T')[0];
          if (sentDate >= startDateStr && sentDate <= endDateStr) {
            allEvents.push({ id: `is-${i.id}`, date: sentDate, type: 'invoice_sent', title: `Invoice received: $${i.amount}`, color: 'text-warning', icon: Receipt, link: `/invoices/${i.id}` });
          }
          if (i.paid_at) {
            const paidDate = i.paid_at.split('T')[0];
            if (paidDate >= startDateStr && paidDate <= endDateStr) {
              allEvents.push({ id: `ip-${i.id}`, date: paidDate, type: 'invoice_paid', title: `Paid: $${i.amount}`, color: 'text-success', icon: Receipt, link: `/invoices/${i.id}` });
            }
          }
        });

        const clientProjectIds = (projectsRes.data || []).map(p => p.id);
        (deliverablesRes.data || []).filter(d => clientProjectIds.includes(d.project_id)).forEach(d => {
          const date = d.created_at.split('T')[0];
          if (date >= startDateStr && date <= endDateStr) {
            allEvents.push({ id: `d-${d.id}`, date, type: 'deliverable', title: `Video delivered: ${d.file_name}`, color: 'text-primary', icon: Upload, link: `${rolePrefix}/projects` });
          }
        });

      } else if (userRole === 'editor') {
        const [assignmentsRes, logsRes, leavesRes] = await Promise.all([
          supabase.from('project_editors').select('project:projects(id,title,status,created_at,completed_at)').eq('editor_id', user.id),
          supabase.from('daily_logs').select('id,date,log_type,work_summary,check_in_at,check_out_at').eq('editor_id', user.id).gte('date', startDateStr).lte('date', endDateStr),
          supabase.from('leave_requests').select('id,start_date,end_date,leave_type,status').eq('editor_id', user.id),
        ]);

        const projects = (assignmentsRes.data || []).map((a: any) => a.project).filter(Boolean);
        projects.forEach((p: any) => {
          if (p.completed_at) {
            const doneDate = p.completed_at.split('T')[0];
            if (doneDate >= startDateStr && doneDate <= endDateStr) {
              allEvents.push({ id: `pd-${p.id}`, date: doneDate, type: 'status_change', title: `Completed: ${p.title}`, color: 'text-success', icon: CheckCircle2, link: '/editor/projects' });
            }
          }
        });

        (logsRes.data || []).forEach(l => {
          if (l.log_type === 'task_update') {
            allEvents.push({ id: `tl-${l.id}`, date: l.date, type: 'task_log', title: 'Task update', detail: l.work_summary || undefined, color: 'text-primary', icon: FileText, link: '/editor/work-logs' });
          } else {
            allEvents.push({ id: `at-${l.id}`, date: l.date, type: 'attendance', title: l.check_in_at ? 'Checked in' : 'Attendance', detail: l.work_summary || undefined, color: 'text-muted-foreground', icon: Clock, link: '/editor/work-logs' });
          }
        });

        (leavesRes.data || []).forEach(l => {
          const start = new Date(l.start_date);
          const end = new Date(l.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            if (dateStr >= startDateStr && dateStr <= endDateStr) {
              allEvents.push({
                id: `lv-${l.id}-${dateStr}`,
                date: dateStr,
                type: 'leave',
                title: `${l.leave_type} leave`,
                detail: l.status,
                color: l.status === 'approved' ? 'text-success' : l.status === 'rejected' ? 'text-destructive' : 'text-warning',
                icon: l.status === 'approved' ? CheckCircle2 : l.status === 'rejected' ? XCircle : Clock,
                link: '/editor/work-logs',
              });
            }
          }
        });
      }

      setEvents(allEvents);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  }, [user, userRole, startDateStr, endDateStr]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) calendarDays.push(null);
  for (let i = 1; i <= totalDays; i++) calendarDays.push(i);

  const eventsByDate = useMemo(() => {
    const map: Record<string, ActivityEvent[]> = {};
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  const handleExport = () => {
    const rows = events.map(e => ({
      Date: e.date,
      Type: e.type,
      Title: e.title,
      Detail: e.detail || '',
    }));
    exportToCSV(rows, `calendar-${startDateStr}-to-${endDateStr}`);
  };

  const handleEventClick = (event: ActivityEvent) => {
    if (event.link) {
      navigate(event.link);
    }
  };

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      <Helmet>
        <title>Calendar | Veylodesk</title>
        <meta name="description" content="View your activity calendar" />
      </Helmet>

      <DashboardLayout role={(userRole as 'admin' | 'client' | 'editor') || 'editor'}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Calendar</h1>
              <p className="text-muted-foreground mt-1">All your activity at a glance</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={events.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Grid */}
              <div className="lg:col-span-2">
                <div className="glass-card rounded-xl p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" onClick={prevMonth}>
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <h2 className="text-lg font-semibold text-foreground">{monthLabel}</h2>
                    <Button variant="ghost" size="icon" onClick={nextMonth}>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                      if (day === null) return <div key={`e-${idx}`} className="aspect-square" />;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayEvents = eventsByDate[dateStr] || [];
                      const isToday = dateStr === today;
                      const isSelected = dateStr === selectedDate;

                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                          className={cn(
                            "aspect-square rounded-lg p-1 flex flex-col items-center justify-start transition-colors relative",
                            isToday && "ring-2 ring-primary",
                            isSelected ? "bg-primary/15" : "hover:bg-muted/50",
                          )}
                        >
                          <span className={cn("text-xs font-medium", isToday ? "text-primary" : "text-foreground")}>{day}</span>
                          {dayEvents.length > 0 && (
                            <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                              {dayEvents.slice(0, 3).map((e, i) => (
                                <div key={i} className={cn("w-1.5 h-1.5 rounded-full", e.color.replace('text-', 'bg-'))} />
                              ))}
                              {dayEvents.length > 3 && <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" />Project</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success" />Completed/Paid</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-warning" />Invoice</span>
                  {userRole === 'editor' && (
                    <>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" />Leave</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted-foreground" />Attendance</span>
                    </>
                  )}
                </div>
              </div>

              {/* Event Detail Panel */}
              <div className="lg:col-span-1">
                <div className="glass-card rounded-xl p-4 sticky top-20">
                  <h3 className="font-semibold text-foreground mb-3">
                    {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
                  </h3>
                  {selectedDate && selectedEvents.length === 0 && (
                    <p className="text-sm text-muted-foreground">No activity on this day.</p>
                  )}
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {selectedEvents.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleEventClick(e)}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-lg bg-muted/30 w-full text-left transition-colors group",
                          e.link && "hover:bg-muted/60 cursor-pointer"
                        )}
                      >
                        <e.icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", e.color)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{e.title}</p>
                          {e.detail && <p className="text-xs text-muted-foreground truncate">{e.detail}</p>}
                        </div>
                        {e.link && (
                          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  {!selectedDate && (
                    <p className="text-sm text-muted-foreground">Click on a day to see activity details.</p>
                  )}
                </div>

                <div className="glass-card rounded-xl p-4 mt-4">
                  <h3 className="font-semibold text-foreground mb-3">Monthly Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total events</span>
                      <span className="font-medium text-foreground">{events.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active days</span>
                      <span className="font-medium text-foreground">{Object.keys(eventsByDate).length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}

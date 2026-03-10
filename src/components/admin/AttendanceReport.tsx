import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Calendar, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Linkify } from '@/lib/linkify';
import { exportToCSV } from '@/lib/exportData';

interface AttendanceReportProps {
  editorId: string;
  agencyId: string;
  employmentType: 'salaried' | 'freelance';
}

interface DailyLog {
  id: string;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  work_summary: string | null;
  log_type: string;
}

export function AttendanceReport({ editorId, agencyId, employmentType }: AttendanceReportProps) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('editor_id', editorId)
          .eq('agency_id', agencyId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        if (error) throw error;
        setLogs((data || []) as DailyLog[]);
      } catch (error) {
        console.error('Error fetching attendance logs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [editorId, agencyId, startDate, endDate]);

  const formatHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return '-';
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  // Summary stats
  const attendanceLogs = logs.filter(l => l.log_type === 'attendance');
  const totalDaysPresent = attendanceLogs.filter(l => l.check_in_at).length;
  const totalHoursMs = attendanceLogs.reduce((sum, l) => {
    if (l.check_in_at && l.check_out_at) {
      return sum + (new Date(l.check_out_at).getTime() - new Date(l.check_in_at).getTime());
    }
    return sum;
  }, 0);
  const totalHours = Math.round(totalHoursMs / 3600000 * 10) / 10;
  const avgHours = totalDaysPresent > 0 ? Math.round((totalHours / totalDaysPresent) * 10) / 10 : 0;

  const handleExport = () => {
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

  return (
    <div className="space-y-4">
      {/* Date filters + export */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8 text-xs" />
        </div>
        <span className="text-muted-foreground text-sm">to</span>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8 text-xs" />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={logs.length === 0} className="ml-auto">
          <Download className="w-3 h-3 mr-1" />
          Export
        </Button>
      </div>

      {/* Summary stats (salaried only) */}
      {employmentType === 'salaried' && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold text-foreground">{totalDaysPresent}</p>
            <p className="text-xs text-muted-foreground">Days Present</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold text-foreground">{totalHours}h</p>
            <p className="text-xs text-muted-foreground">Total Hours</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold text-foreground">{avgHours}h</p>
            <p className="text-xs text-muted-foreground">Avg/Day</p>
          </div>
        </div>
      )}

      {/* Logs table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No records found for this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
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
                  <td className="p-3 text-muted-foreground max-w-[300px] truncate">{log.work_summary || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

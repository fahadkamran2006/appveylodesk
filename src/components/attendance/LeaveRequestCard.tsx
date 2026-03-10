import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, Plus, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaveRequestCardProps {
  agencyId: string;
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

export function LeaveRequestCard({ agencyId }: LeaveRequestCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('casual');
  const [reason, setReason] = useState('');

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('editor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setRequests((data || []) as LeaveRequest[]);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async () => {
    if (!user || !startDate || !endDate || !reason.trim()) return;

    if (new Date(endDate) < new Date(startDate)) {
      toast({ title: 'Invalid dates', description: 'End date must be after start date.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('leave_requests').insert({
        editor_id: user.id,
        agency_id: agencyId,
        start_date: startDate,
        end_date: endDate,
        leave_type: leaveType,
        reason: reason.trim(),
      });
      if (error) throw error;
      toast({ title: 'Leave Request Submitted', description: 'Your leave request is pending approval.' });
      setStartDate('');
      setEndDate('');
      setLeaveType('casual');
      setReason('');
      setShowForm(false);
      fetchRequests();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success border-success/20';
      case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const leaveTypeLabel = (type: string) => {
    switch (type) {
      case 'sick': return 'Sick Leave';
      case 'casual': return 'Casual Leave';
      case 'unpaid': return 'Unpaid Leave';
      default: return type;
    }
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Leave Requests</h3>
            <p className="text-xs text-muted-foreground">Request time off</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? '' : 'New'}
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 mb-4 p-4 rounded-lg bg-muted/30 border border-border/50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-background" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Leave Type</label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual Leave</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="unpaid">Unpaid Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Reason</label>
            <Textarea
              placeholder="Why do you need time off?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-background min-h-[80px]"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !startDate || !endDate || !reason.trim()}
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Submit Request
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No leave requests yet.</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {requests.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{leaveTypeLabel(req.leave_type)}</span>
                  <Badge variant="secondary" className={cn("text-xs border", statusColor(req.status))}>
                    {req.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(req.start_date).toLocaleDateString()} — {new Date(req.end_date).toLocaleDateString()}
                </p>
                {req.admin_note && (
                  <p className="text-xs text-muted-foreground mt-1 italic">Admin: {req.admin_note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

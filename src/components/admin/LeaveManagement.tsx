import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, CheckCircle2, XCircle, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaveManagementProps {
  agencyId: string;
  /** If provided, filter to a specific editor */
  editorId?: string;
}

interface LeaveRequestWithEditor {
  id: string;
  editor_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  editor_name?: string;
  editor_email?: string;
  editor_avatar?: string | null;
}

export function LeaveManagement({ agencyId, editorId }: LeaveManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequestWithEditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const fetchRequests = useCallback(async () => {
    try {
      let query = supabase
        .from('leave_requests')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (editorId) {
        query = query.eq('editor_id', editorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch editor profiles
      const editorIds = [...new Set((data || []).map((r: any) => r.editor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', editorIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enriched: LeaveRequestWithEditor[] = (data || []).map((r: any) => {
        const profile = profileMap.get(r.editor_id);
        return {
          ...r,
          editor_name: profile?.full_name || undefined,
          editor_email: profile?.email || undefined,
          editor_avatar: profile?.avatar_url,
        };
      });

      setRequests(enriched);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  }, [agencyId, editorId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!user) return;
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_note: adminNotes[requestId] || null,
        })
        .eq('id', requestId);

      if (error) throw error;
      toast({
        title: `Leave ${status}`,
        description: `The leave request has been ${status}.`,
      });
      fetchRequests();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
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
      case 'sick': return 'Sick';
      case 'casual': return 'Casual';
      case 'unpaid': return 'Unpaid';
      default: return type;
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return (email || '??').slice(0, 2).toUpperCase();
  };

  const getDayCount = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8">
        <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No leave requests found.</p>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pastRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            Pending ({pendingRequests.length})
          </h4>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="rounded-lg border border-warning/20 bg-warning/5 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {!editorId && (
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={req.editor_avatar || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {getInitials(req.editor_name, req.editor_email)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      {!editorId && <p className="text-sm font-medium text-foreground">{req.editor_name || req.editor_email}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">{leaveTypeLabel(req.leave_type)}</Badge>
                        <span>{getDayCount(req.start_date, req.end_date)} day(s)</span>
                        <span>•</span>
                        <span>{new Date(req.start_date).toLocaleDateString()} — {new Date(req.end_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-foreground bg-muted/30 p-2 rounded">{req.reason}</p>
                <Textarea
                  placeholder="Admin note (optional)"
                  className="bg-background text-xs min-h-[60px]"
                  value={adminNotes[req.id] || ''}
                  onChange={(e) => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => handleAction(req.id, 'approved')}
                    disabled={processingId === req.id}
                  >
                    {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => handleAction(req.id, 'rejected')}
                    disabled={processingId === req.id}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past requests */}
      {pastRequests.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">History</h4>
          <div className="space-y-2">
            {pastRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {!editorId && (
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={req.editor_avatar || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                        {getInitials(req.editor_name, req.editor_email)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!editorId && <span className="text-sm font-medium text-foreground">{req.editor_name || req.editor_email}</span>}
                      <Badge variant="secondary" className="text-xs">{leaveTypeLabel(req.leave_type)}</Badge>
                      <Badge variant="secondary" className={cn("text-xs border", statusColor(req.status))}>{req.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.start_date).toLocaleDateString()} — {new Date(req.end_date).toLocaleDateString()}
                      ({getDayCount(req.start_date, req.end_date)} days)
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

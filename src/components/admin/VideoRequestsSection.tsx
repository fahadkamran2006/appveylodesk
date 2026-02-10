import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ProjectDetailSheet } from '@/components/projects/ProjectDetailSheet';
import { Video, Calendar, Check, X, Loader2, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Project } from '@/hooks/useProjects';

interface VideoRequestsSectionProps {
  requests: Project[];
  loading: boolean;
  onRefresh: () => void;
}

export function VideoRequestsSection({ requests, loading, onRefresh }: VideoRequestsSectionProps) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const handleApprove = async (e: React.MouseEvent, request: Project) => {
    e.stopPropagation();
    setProcessing(request.id);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'backlog' })
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: 'Request approved',
        description: `"${request.title}" has been moved to the backlog.`,
      });
      setSelectedRequestId(null);
      onRefresh();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: 'Failed to approve',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!deleteConfirm) return;
    
    setProcessing(deleteConfirm.id);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: 'Request rejected',
        description: `"${deleteConfirm.title}" has been removed.`,
      });
      setDeleteConfirm(null);
      setSelectedRequestId(null);
      onRefresh();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast({
        title: 'Failed to reject',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Video Requests</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Video Requests</h2>
            <Badge variant="secondary" className="bg-warning/20 text-warning">
              {requests.length} pending
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          {requests.map((request) => {
            const initials = request.client_name
              ? request.client_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : '??';

            const isProcessing = processing === request.id;

            return (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSelectedRequestId(request.id)}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{request.title}</p>
                      <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span>{request.client_name || 'Unknown Client'}</span>
                      {request.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(request.due_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                    {request.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {request.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(request);
                    }}
                    disabled={isProcessing}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline ml-1">Reject</span>
                  </Button>
                  <Button
                    variant="hero"
                    size="sm"
                    onClick={(e) => handleApprove(e, request)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline ml-1">Approve</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Detail Sheet for viewing full request details */}
      <ProjectDetailSheet
        projectId={selectedRequestId}
        open={!!selectedRequestId}
        onOpenChange={(open) => !open && setSelectedRequestId(null)}
        onProjectDeleted={onRefresh}
      />

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Video Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the request "{deleteConfirm?.title}" from {deleteConfirm?.client_name || 'the client'}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!!processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? 'Rejecting...' : 'Reject Request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, RotateCcw, Loader2 } from 'lucide-react';

interface VideoApprovalActionsProps {
  projectId: string;
  projectTitle: string;
  status: string;
  onStatusChange: () => void;
}

export function VideoApprovalActions({
  projectId,
  projectTitle,
  status,
  onStatusChange,
}: VideoApprovalActionsProps) {
  const { toast } = useToast();
  const [isApproving, setIsApproving] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');
  const [isRequestingRevision, setIsRequestingRevision] = useState(false);

  // Only show for review status
  if (status !== 'review') {
    return null;
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'done' })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: 'Video approved!',
        description: `"${projectTitle}" has been moved to Delivered.`,
      });

      onStatusChange();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve video',
        variant: 'destructive',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionComment.trim()) {
      toast({
        title: 'Comment required',
        description: 'Please provide feedback for the revision request.',
        variant: 'destructive',
      });
      return;
    }

    setIsRequestingRevision(true);
    try {
      // Update status to in_progress
      const { error: statusError } = await supabase
        .from('projects')
        .update({ status: 'in_progress' })
        .eq('id', projectId);

      if (statusError) throw statusError;

      // Add comment as a deliverable comment on the latest video (optional - for now just update status)
      // The notification trigger will handle notifying the team

      toast({
        title: 'Revision requested',
        description: `"${projectTitle}" has been sent back for revisions.`,
      });

      setShowRevisionModal(false);
      setRevisionComment('');
      onStatusChange();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to request revision',
        variant: 'destructive',
      });
    } finally {
      setIsRequestingRevision(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mt-4 p-4 rounded-lg bg-warning/10 border border-warning/20">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Ready for your review</p>
          <p className="text-xs text-muted-foreground">
            Please review the deliverable and approve or request changes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRevisionModal(true)}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Request Revision
          </Button>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isApproving}
            className="gap-2 bg-success hover:bg-success/90"
          >
            {isApproving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Approve
          </Button>
        </div>
      </div>

      {/* Revision Request Modal */}
      <Dialog open={showRevisionModal} onOpenChange={setShowRevisionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-warning" />
              Request Revision
            </DialogTitle>
            <DialogDescription>
              Provide feedback about what changes are needed for "{projectTitle}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="revision-comment">Revision Notes</Label>
              <Textarea
                id="revision-comment"
                placeholder="Describe what changes you'd like to see..."
                value={revisionComment}
                onChange={(e) => setRevisionComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRevisionModal(false)}
              disabled={isRequestingRevision}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestRevision}
              disabled={isRequestingRevision || !revisionComment.trim()}
              className="gap-2"
            >
              {isRequestingRevision ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Send Revision Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, LogOut } from 'lucide-react';

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (workSummary: string) => Promise<void>;
  checkInTime: string;
}

export function CheckoutModal({ open, onOpenChange, onConfirm, checkInTime }: CheckoutModalProps) {
  const [workSummary, setWorkSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!workSummary.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(workSummary.trim());
      setWorkSummary('');
    } catch {
      // error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  const elapsed = checkInTime
    ? Math.floor((Date.now() - new Date(checkInTime).getTime()) / 1000)
    : 0;
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { setWorkSummary(''); onOpenChange(v); } }}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <LogOut className="w-5 h-5 text-destructive" />
            Check Out
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            You've been working for {hours}h {minutes}m. Please summarize your work before checking out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Work Summary <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="What did you work on during this shift? List tasks completed, projects worked on..."
              className="bg-surface-elevated border-border/50 min-h-[120px]"
              value={workSummary}
              onChange={(e) => setWorkSummary(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { setWorkSummary(''); onOpenChange(false); }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleConfirm}
              disabled={submitting || !workSummary.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Check Out'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

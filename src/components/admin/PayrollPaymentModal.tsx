import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface PayrollPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: {
    id: string;
    full_name: string | null;
    email: string;
    employment_type: string;
    monthly_salary: number | null;
    accumulated_bonus: number;
    freelance_earnings: number;
  } | null;
  agencyId: string;
  onSuccess?: () => void;
}

export function PayrollPaymentModal({
  open,
  onOpenChange,
  editor,
  agencyId,
  onSuccess,
}: PayrollPaymentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  if (!editor) return null;

  const isSalaried = editor.employment_type === 'salaried';
  const baseAmount = isSalaried ? (editor.monthly_salary || 0) : editor.freelance_earnings;
  const bonusAmount = isSalaried ? editor.accumulated_bonus : 0;
  const totalAmount = baseAmount + bonusAmount;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const handleMarkPaid = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('payroll_payments')
        .upsert({
          agency_id: agencyId,
          editor_id: editor.id,
          period_month: currentMonth,
          period_year: currentYear,
          base_amount: baseAmount,
          bonus_amount: bonusAmount,
          total_amount: totalAmount,
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_by: user.id,
          note: note || null,
        }, {
          onConflict: 'agency_id,editor_id,period_month,period_year',
        });

      if (error) throw error;

      // Reset accumulated bonus after payment for salaried
      if (isSalaried && bonusAmount > 0) {
        await (supabase as any)
          .from('employee_compensation')
          .upsert({
            user_id: editor.id,
            accumulated_bonus: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      }

      toast({
        title: 'Payment recorded',
        description: `$${totalAmount.toLocaleString()} marked as paid for ${editor.full_name || editor.email}.`,
      });

      setNote('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to record payment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) { setNote(''); onOpenChange(v); } }}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Mark as Paid
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Record payment for {editor.full_name || editor.email} — {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Pay</span>
              <span className="text-foreground font-medium">${baseAmount.toLocaleString()}</span>
            </div>
            {isSalaried && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bonus</span>
                <span className="text-success font-medium">{bonusAmount > 0 ? `+$${bonusAmount.toLocaleString()}` : '-'}</span>
              </div>
            )}
            <div className="border-t border-border/50 pt-2 flex justify-between">
              <span className="font-semibold text-foreground">Total</span>
              <span className="font-bold text-primary text-lg">${totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="e.g., Paid via bank transfer"
              className="bg-surface-elevated border-border/50"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { setNote(''); onOpenChange(false); }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleMarkPaid}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Payment'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

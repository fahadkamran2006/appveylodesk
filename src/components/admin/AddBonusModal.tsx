import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, DollarSign } from 'lucide-react';

const bonusSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  note: z.string().optional(),
});

type BonusFormData = z.infer<typeof bonusSchema>;

interface AddBonusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: {
    id: string;
    full_name: string | null;
    email: string;
    accumulated_bonus: number;
  } | null;
  onSuccess?: () => void;
}

export function AddBonusModal({
  open,
  onOpenChange,
  editor,
  onSuccess,
}: AddBonusModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<BonusFormData>({
    resolver: zodResolver(bonusSchema),
    defaultValues: {
      amount: '',
      note: '',
    },
  });

  const onSubmit = async (data: BonusFormData) => {
    if (!editor) return;

    setIsSubmitting(true);
    try {
      const bonusAmount = parseFloat(data.amount.replace(/[^0-9.]/g, ''));
      
      if (isNaN(bonusAmount) || bonusAmount <= 0) {
        throw new Error('Please enter a valid bonus amount');
      }

      const newTotal = (editor.accumulated_bonus || 0) + bonusAmount;

      const { error } = await supabase
        .from('profiles')
        .update({
          accumulated_bonus: newTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editor.id);

      if (error) throw error;

      toast({
        title: 'Bonus added',
        description: `$${bonusAmount.toLocaleString()} bonus added to ${editor.full_name || editor.email}'s account.`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add bonus',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Gift className="w-5 h-5 text-primary" />
            Add End-of-Month Bonus
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add a bonus to {editor?.full_name || editor?.email}'s accumulated pay.
            <br />
            <span className="text-xs">
              Current accumulated bonus: ${(editor?.accumulated_bonus || 0).toLocaleString()}
            </span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Bonus Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Bonus Amount
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="text"
                        placeholder="e.g., 500"
                        className="bg-surface-elevated border-border/50 pl-7"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Optional Note */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    Note <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Performance bonus for Q4"
                      className="bg-surface-elevated border-border/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Bonus'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

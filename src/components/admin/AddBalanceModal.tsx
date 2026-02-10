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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Wallet } from 'lucide-react';

const balanceSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  amount: z.string().min(1, 'Amount is required'),
  type: z.enum(['owed', 'deduction']),
  note: z.string().optional(),
});

type BalanceFormData = z.infer<typeof balanceSchema>;

interface AddBalanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  agencyId: string;
  onSuccess?: () => void;
}

export function AddBalanceModal({
  open,
  onOpenChange,
  editor,
  agencyId,
  onSuccess,
}: AddBalanceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<BalanceFormData>({
    resolver: zodResolver(balanceSchema),
    defaultValues: {
      label: '',
      amount: '',
      type: 'owed',
      note: '',
    },
  });

  const onSubmit = async (data: BalanceFormData) => {
    if (!editor) return;

    setIsSubmitting(true);
    try {
      const amount = parseFloat(data.amount.replace(/[^0-9.]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const { error } = await supabase
        .from('editor_balances')
        .insert({
          agency_id: agencyId,
          editor_id: editor.id,
          label: data.label,
          amount,
          type: data.type,
          note: data.note || null,
        });

      if (error) throw error;

      toast({
        title: 'Balance entry added',
        description: `${data.type === 'owed' ? 'Company owes' : 'Deduction of'} $${amount.toLocaleString()} added for ${editor.full_name || editor.email}.`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add balance entry',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) { form.reset(); onOpenChange(v); } }}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Wallet className="w-5 h-5 text-primary" />
            Add Balance Entry
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Track what the company owes or deductions for {editor?.full_name || editor?.email}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Label</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Security Fund, Advance"
                      className="bg-surface-elevated border-border/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-surface-elevated border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="owed">Company Owes (e.g., security fund)</SelectItem>
                      <SelectItem value="deduction">Deduction (e.g., advance repayment)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Amount</FormLabel>
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
                      placeholder="e.g., Security deposit held until contract end"
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
                onClick={() => { form.reset(); onOpenChange(false); }}
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
                  'Add Entry'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

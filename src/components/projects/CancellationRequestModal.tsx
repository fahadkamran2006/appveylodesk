import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';

const cancellationSchema = z.object({
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)'),
});

type CancellationFormData = z.infer<typeof cancellationSchema>;

interface CancellationRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
  onConfirm: (reason: string) => Promise<boolean>;
}

export function CancellationRequestModal({
  open,
  onOpenChange,
  projectTitle,
  onConfirm,
}: CancellationRequestModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CancellationFormData>({
    resolver: zodResolver(cancellationSchema),
    defaultValues: {
      reason: '',
    },
  });

  const onSubmit = async (data: CancellationFormData) => {
    setIsSubmitting(true);
    try {
      const success = await onConfirm(data.reason);
      if (success) {
        form.reset();
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Request Cancellation
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            You are requesting to cancel "{projectTitle}". This request will be reviewed by the agency admin.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    Reason for Cancellation
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please explain why you want to cancel this project..."
                      className="bg-surface-elevated border-border/50 resize-none min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <p className="text-sm text-warning">
                Note: Cancellation is subject to admin approval. Any work already completed may still be billed.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Keep Project
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Request Cancellation'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

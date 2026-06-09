import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus } from 'lucide-react';

const schema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Invalid email').max(255),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddManualClientModal({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', email: '', company: '', phone: '', notes: '' },
  });

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole?.agency_id) throw new Error('Could not find your agency');

      const { error } = await supabase.from('managed_clients').insert({
        agency_id: userRole.agency_id,
        email: data.email.toLowerCase().trim(),
        full_name: data.full_name.trim(),
        company: data.company?.trim() || null,
        phone: data.phone?.trim() || null,
        notes: data.notes?.trim() || null,
        created_by: user.id,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('A client with this email already exists in your agency');
        }
        throw error;
      }

      toast({ title: 'Client added', description: `${data.full_name} added without invitation.` });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to add client', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="w-5 h-5 text-primary" />
            Add Client Manually
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a client record without sending an invitation. You can give them dashboard access later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Full Name</FormLabel>
                <FormControl><Input placeholder="Jane Doe" className="bg-surface-elevated border-border/50" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Email Address</FormLabel>
                <FormControl><Input type="email" placeholder="jane@example.com" className="bg-surface-elevated border-border/50" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="company" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Company <span className="text-muted-foreground">(optional)</span></FormLabel>
                <FormControl><Input placeholder="Acme Inc." className="bg-surface-elevated border-border/50" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Phone <span className="text-muted-foreground">(optional)</span></FormLabel>
                <FormControl><Input placeholder="+1 555 123 4567" className="bg-surface-elevated border-border/50" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Notes <span className="text-muted-foreground">(optional)</span></FormLabel>
                <FormControl><Textarea rows={3} placeholder="Internal notes about this client..." className="bg-surface-elevated border-border/50" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Add Client'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

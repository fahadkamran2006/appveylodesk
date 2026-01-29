import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().optional(),
  role: z.enum(['client', 'editor']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedRole?: 'client' | 'editor';
  onSuccess?: () => void;
}

export function InviteUserModal({
  open,
  onOpenChange,
  lockedRole,
  onSuccess,
}: InviteUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      name: '',
      role: lockedRole || 'client',
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Get current user's agency_id
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError || !userRole?.agency_id) {
        throw new Error('Could not find your agency');
      }

      const agencyId = userRole.agency_id;

      // Check client limit if inviting a client
      if (data.role === 'client') {
        const { data: canAdd, error: limitError } = await supabase
          .rpc('check_client_limit', { _agency_id: agencyId });

        if (limitError) {
          console.error('Error checking client limit:', limitError);
        } else if (canAdd === false) {
          toast({
            title: 'Client limit reached',
            description: 'Upgrade to Growth or Scale to invite more clients.',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Create an invitation (don't create placeholder auth users)
      const { data: invitation, error: inviteError } = await supabase
        .from('agency_invitations')
        .insert({
          agency_id: agencyId,
          email: data.email.toLowerCase().trim(),
          full_name: data.name?.trim() ? data.name.trim() : null,
          role: data.role,
          invited_by: user.id,
        })
        .select('id')
        .single();

      if (inviteError) {
        throw inviteError;
      }

      // Get agency name for email
      const { data: agency } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', agencyId)
        .single();

      // Send invite email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          invitationId: invitation.id,
          email: data.email.toLowerCase().trim(),
          role: data.role,
          agencyName: agency?.name || 'Your Agency',
        },
      });

      if (emailError) {
        console.error('Failed to send email:', emailError);
        // Don't throw - the invite was created, just email failed
      }

      toast({
        title: 'Invite sent!',
        description: `Invite sent to ${data.email}`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleLabel = lockedRole === 'client' ? 'Client' : lockedRole === 'editor' ? 'Team Member' : 'User';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite {roleLabel}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Send an invitation to join your agency.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Email Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="name@example.com"
                      type="email"
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    Name <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      className="bg-surface-elevated border-border/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!lockedRole && (
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-surface-elevated border-border/50">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
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
                    Sending...
                  </>
                ) : (
                  'Send Invite'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAgencyLimits } from '@/hooks/useAgencyLimits';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, KeyRound, AlertCircle } from 'lucide-react';

interface ManagedClient {
  id: string;
  email: string;
  full_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ManagedClient | null;
  onSuccess?: () => void;
}

export function ActivateClientModal({ open, onOpenChange, client, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canAddClient, currentClients, maxClients, planTier } = useAgencyLimits();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (client) setEmail(client.email);
  }, [client]);

  const handleActivate = async () => {
    if (!user || !client) return;
    if (!canAddClient()) {
      toast({
        title: 'Client limit reached',
        description: `Your ${planTier} plan allows ${maxClients} active clients.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Update email if changed
      if (email.toLowerCase().trim() !== client.email.toLowerCase()) {
        const { error: updErr } = await supabase
          .from('managed_clients')
          .update({ email: email.toLowerCase().trim() })
          .eq('id', client.id);
        if (updErr) throw updErr;
      }

      // Create invitation via RPC
      const { data: invitationId, error: rpcErr } = await supabase
        .rpc('activate_managed_client', { _managed_id: client.id });
      if (rpcErr) throw rpcErr;

      // Get agency name
      const { data: ur } = await supabase
        .from('user_roles').select('agency_id').eq('user_id', user.id).maybeSingle();
      const { data: agency } = await supabase
        .from('agencies').select('name').eq('id', ur?.agency_id ?? '').single();

      // Send invite email
      const { error: emailErr } = await supabase.functions.invoke('send-invite-email', {
        body: {
          invitationId,
          email: email.toLowerCase().trim(),
          role: 'client',
          agencyName: agency?.name || 'Your Agency',
        },
      });
      if (emailErr) console.error('Invite email failed:', emailErr);

      toast({
        title: 'Invitation sent',
        description: `${client.full_name || email} will get dashboard access once they accept.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to activate', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <KeyRound className="w-5 h-5 text-primary" />
            Give Dashboard Access
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Send {client?.full_name || 'this client'} an invitation to claim their dashboard. All their existing projects and invoices will transfer once they accept.
          </DialogDescription>
        </DialogHeader>

        {!canAddClient() && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Client limit reached ({currentClients}/{maxClients}) on your {planTier} plan. Upgrade to activate more clients.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="activate-email" className="text-foreground">Email to invite</Label>
          <Input
            id="activate-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-surface-elevated border-border/50"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleActivate}
            disabled={submitting || !email || !canAddClient()}
          >
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

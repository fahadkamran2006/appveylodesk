import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface RoleOpt { id: string; name: string }

export function InviteStaffModal({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [roles, setRoles] = useState<RoleOpt[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data: ur } = await supabase.from('user_roles').select('agency_id').eq('user_id', user.id).maybeSingle();
      const aid = ur?.agency_id || '';
      setAgencyId(aid);
      if (!aid) return;
      const { data: ag } = await supabase.from('agencies').select('name').eq('id', aid).maybeSingle();
      setAgencyName(ag?.name || 'Your Agency');
      const { data: r } = await (supabase as any).from('staff_roles').select('id,name').eq('agency_id', aid).order('name');
      setRoles((r as RoleOpt[]) || []);
    })();
  }, [open, user]);

  const handleSubmit = async () => {
    if (!email.trim() || !roleId) {
      toast({ title: 'Email and role are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data: invitation, error: inviteError } = await supabase
        .from('agency_invitations')
        .insert({
          agency_id: agencyId,
          email: email.trim().toLowerCase(),
          full_name: name.trim() || null,
          role: 'staff' as any,
          invited_by: user!.id,
          metadata: { staff_role_id: roleId } as any,
        } as any)
        .select('id')
        .single();
      if (inviteError) throw inviteError;

      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          invitationId: invitation.id,
          email: email.trim().toLowerCase(),
          role: 'staff',
          agencyName,
        },
      });
      if (emailError) {
        throw new Error(`Invitation saved, but email delivery failed: ${emailError.message}`);
      }

      toast({ title: 'Staff invite sent', description: `Invitation sent to ${email}` });
      setEmail(''); setName(''); setRoleId('');
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> Invite Staff Member</DialogTitle>
          <DialogDescription>Add a manager, accountant, HR, or any custom role.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="staff-email">Email</Label>
            <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div>
            <Label htmlFor="staff-name">Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="Select a role template" /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {roles.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No role templates yet. Create one in Settings → Roles.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

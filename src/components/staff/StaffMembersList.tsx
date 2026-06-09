import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Shield, Users, Trash2 } from 'lucide-react';
import { StaffPermissionOverridesModal } from './StaffPermissionOverridesModal';
import { StaffAssignmentsModal } from './StaffAssignmentsModal';
import { toast } from 'sonner';

interface StaffRow {
  id: string;
  user_id: string;
  agency_id: string;
  staff_role_id: string | null;
  permission_overrides: Record<string, boolean>;
  staff_roles?: { name: string } | null;
  profiles?: { full_name: string | null; email: string; avatar_url: string | null } | null;
}

interface Props {
  agencyId: string;
}

export function StaffMembersList({ agencyId }: Props) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [permsTarget, setPermsTarget] = useState<StaffRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<StaffRow | null>(null);

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('staff_members')
      .select('id, user_id, agency_id, staff_role_id, permission_overrides, staff_roles(name), profiles!staff_members_user_id_fkey(full_name,email,avatar_url)')
      .eq('agency_id', agencyId);
    if (error) toast.error(error.message);
    setRows((data as StaffRow[]) || []);
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  const remove = async (row: StaffRow) => {
    if (!confirm(`Remove ${row.profiles?.full_name || row.profiles?.email}? This revokes their staff access.`)) return;
    const { error: e1 } = await (supabase as any).from('staff_members').delete().eq('id', row.id);
    if (e1) return toast.error(e1.message);
    await supabase.from('user_roles').delete().eq('user_id', row.user_id).eq('agency_id', agencyId).eq('role', 'staff' as any);
    toast.success('Staff member removed');
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No staff members yet. Invite one using the "Invite Staff" button.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const name = row.profiles?.full_name || row.profiles?.email || 'Staff';
        const initials = (name).split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
        const overrideCount = Object.keys(row.permission_overrides || {}).length;
        return (
          <Card key={row.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <Avatar><AvatarImage src={row.profiles?.avatar_url || undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{name}</div>
                <div className="text-xs text-muted-foreground truncate">{row.profiles?.email}</div>
                <div className="flex gap-2 mt-1 items-center flex-wrap">
                  <Badge variant="secondary">{row.staff_roles?.name || 'No role'}</Badge>
                  {overrideCount > 0 && <Badge variant="outline">{overrideCount} override{overrideCount === 1 ? '' : 's'}</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPermsTarget(row)}>
                  <Shield className="w-4 h-4 mr-1" /> Permissions
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAssignTarget(row)}>
                  <Users className="w-4 h-4 mr-1" /> Assignments
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(row)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <StaffPermissionOverridesModal
        open={!!permsTarget}
        onOpenChange={(o) => !o && setPermsTarget(null)}
        staffMember={permsTarget ? {
          id: permsTarget.id,
          user_id: permsTarget.user_id,
          full_name: permsTarget.profiles?.full_name || permsTarget.profiles?.email || 'Staff',
          staff_role_id: permsTarget.staff_role_id,
          permission_overrides: permsTarget.permission_overrides || {},
        } : null}
        onSaved={load}
      />

      <StaffAssignmentsModal
        open={!!assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        staffMember={assignTarget ? {
          user_id: assignTarget.user_id,
          full_name: assignTarget.profiles?.full_name || assignTarget.profiles?.email || 'Staff',
          agency_id: assignTarget.agency_id,
        } : null}
        onSaved={load}
      />
    </div>
  );
}

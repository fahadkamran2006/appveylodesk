import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PERMISSION_CATALOG } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: { id: string; user_id: string; full_name: string; staff_role_id: string | null; permission_overrides: Record<string, boolean> } | null;
  onSaved?: () => void;
}

export function StaffPermissionOverridesModal({ open, onOpenChange, staffMember, onSaved }: Props) {
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !staffMember) return;
    (async () => {
      setLoading(true);
      setOverrides(staffMember.permission_overrides || {});
      if (staffMember.staff_role_id) {
        const { data } = await (supabase as any).from('staff_roles').select('permissions').eq('id', staffMember.staff_role_id).maybeSingle();
        setRolePerms((data?.permissions as Record<string, boolean>) || {});
      } else {
        setRolePerms({});
      }
      setLoading(false);
    })();
  }, [open, staffMember]);

  const effective = (key: string) => (key in overrides ? overrides[key] : !!rolePerms[key]);
  const toggle = (key: string) => {
    const current = effective(key);
    const next = !current;
    const baseline = !!rolePerms[key];
    setOverrides((prev) => {
      const copy = { ...prev };
      if (next === baseline) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  };

  const save = async () => {
    if (!staffMember) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('staff_members')
      .update({ permission_overrides: overrides })
      .eq('id', staffMember.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Permissions updated');
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Permissions{staffMember ? ` — ${staffMember.full_name}` : ''}</DialogTitle>
          <DialogDescription>Per-user overrides on top of the assigned role template.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {PERMISSION_CATALOG.map((group) => (
                <div key={group.title}>
                  <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-2">{group.title}</h3>
                  <div className="space-y-2">
                    {group.permissions.map((p) => (
                      <div key={p.key} className="flex items-center gap-2">
                        <Checkbox id={p.key} checked={effective(p.key)} onCheckedChange={() => toggle(p.key)} />
                        <Label htmlFor={p.key} className="cursor-pointer text-sm font-normal">
                          {p.label}
                          {p.key in overrides && <span className="ml-2 text-xs text-primary">(override)</span>}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

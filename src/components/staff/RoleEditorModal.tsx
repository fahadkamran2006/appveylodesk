import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { PERMISSION_CATALOG } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

export interface StaffRoleRecord {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  scope_clients: 'all' | 'assigned';
  scope_projects: 'all' | 'assigned';
  is_system: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: StaffRoleRecord | null;
  agencyId: string;
  onSaved: () => void;
}

export function RoleEditorModal({ open, onOpenChange, role, agencyId, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [scopeClients, setScopeClients] = useState<'all' | 'assigned'>('all');
  const [scopeProjects, setScopeProjects] = useState<'all' | 'assigned'>('all');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(role?.name || '');
      setDescription(role?.description || '');
      setPerms((role?.permissions as Record<string, boolean>) || {});
      setScopeClients(role?.scope_clients || 'all');
      setScopeProjects(role?.scope_projects || 'all');
    }
  }, [open, role]);

  const toggle = (key: string, val: boolean) => setPerms((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        agency_id: agencyId,
        name: name.trim(),
        description: description.trim() || null,
        permissions: perms,
        scope_clients: scopeClients,
        scope_projects: scopeProjects,
        created_by: user?.id,
      };
      const client = supabase as any;
      const { error } = role
        ? await client.from('staff_roles').update(payload).eq('id', role.id)
        : await client.from('staff_roles').insert(payload);
      if (error) throw error;
      toast({ title: role ? 'Role updated' : 'Role created' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const groupsByArea: Record<string, typeof PERMISSION_CATALOG> = {};
  PERMISSION_CATALOG.forEach((g) => {
    groupsByArea[g.area] = groupsByArea[g.area] || [];
    groupsByArea[g.area].push(g);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>Define what this role can see and do across the agency.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manager" />
            </div>
            <div>
              <Label htmlFor="role-desc">Description</Label>
              <Input id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this role do?" />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Client visibility</Label>
                <p className="text-xs text-muted-foreground">{scopeClients === 'all' ? 'Can see all clients' : 'Only assigned clients'}</p>
              </div>
              <Switch checked={scopeClients === 'all'} onCheckedChange={(v) => setScopeClients(v ? 'all' : 'assigned')} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Project visibility</Label>
                <p className="text-xs text-muted-foreground">{scopeProjects === 'all' ? 'Can see all projects' : 'Only assigned projects'}</p>
              </div>
              <Switch checked={scopeProjects === 'all'} onCheckedChange={(v) => setScopeProjects(v ? 'all' : 'assigned')} />
            </div>
          </div>

          {(['operations', 'finance', 'hr', 'workspace'] as const).map((area) => (
            <div key={area} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{area}</h3>
              {(groupsByArea[area] || []).map((g) => (
                <div key={g.title} className="border border-border/50 rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">{g.title}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.permissions.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={!!perms[p.key]} onCheckedChange={(v) => toggle(p.key, !!v)} />
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {role ? 'Save changes' : 'Create role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

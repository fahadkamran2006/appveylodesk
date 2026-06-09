import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: { user_id: string; full_name: string; agency_id: string } | null;
  onSaved?: () => void;
}

interface ClientOpt { id: string; full_name: string; email: string; kind: 'user' | 'managed' }
interface ProjectOpt { id: string; title: string }

export function StaffAssignmentsModal({ open, onOpenChange, staffMember, onSaved }: Props) {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !staffMember) return;
    (async () => {
      setLoading(true);
      const [clientRoles, managed, projs, existingClients, existingProjects] = await Promise.all([
        supabase.from('user_roles').select('user_id, profiles!user_roles_user_id_fkey(full_name,email)').eq('agency_id', staffMember.agency_id).eq('role', 'client'),
        (supabase as any).from('managed_clients').select('id, full_name, email').eq('agency_id', staffMember.agency_id),
        supabase.from('projects').select('id, title').eq('agency_id', staffMember.agency_id).order('created_at', { ascending: false }).limit(500),
        (supabase as any).from('staff_client_assignments').select('client_user_id, managed_client_id').eq('staff_user_id', staffMember.user_id),
        (supabase as any).from('staff_project_assignments').select('project_id').eq('staff_user_id', staffMember.user_id),
      ]);

      const c: ClientOpt[] = [];
      (clientRoles.data || []).forEach((r: any) => {
        c.push({ id: `user:${r.user_id}`, full_name: r.profiles?.full_name || r.profiles?.email || 'Client', email: r.profiles?.email || '', kind: 'user' });
      });
      (managed.data || []).forEach((m: any) => {
        c.push({ id: `managed:${m.id}`, full_name: m.full_name, email: m.email, kind: 'managed' });
      });
      setClients(c);
      setProjects((projs.data as any[]) || []);

      const sc = new Set<string>();
      (existingClients.data || []).forEach((r: any) => {
        if (r.client_user_id) sc.add(`user:${r.client_user_id}`);
        if (r.managed_client_id) sc.add(`managed:${r.managed_client_id}`);
      });
      setSelectedClients(sc);
      setSelectedProjects(new Set((existingProjects.data || []).map((r: any) => r.project_id)));
      setLoading(false);
    })();
  }, [open, staffMember]);

  const save = async () => {
    if (!staffMember) return;
    setSaving(true);

    // Replace strategy: delete then insert
    await Promise.all([
      (supabase as any).from('staff_client_assignments').delete().eq('staff_user_id', staffMember.user_id),
      (supabase as any).from('staff_project_assignments').delete().eq('staff_user_id', staffMember.user_id),
    ]);

    const clientRows = Array.from(selectedClients).map((id) => {
      const [kind, val] = id.split(':');
      return {
        staff_user_id: staffMember.user_id,
        agency_id: staffMember.agency_id,
        client_user_id: kind === 'user' ? val : null,
        managed_client_id: kind === 'managed' ? val : null,
      };
    });
    const projectRows = Array.from(selectedProjects).map((pid) => ({
      staff_user_id: staffMember.user_id,
      agency_id: staffMember.agency_id,
      project_id: pid,
    }));

    const errs: string[] = [];
    if (clientRows.length) {
      const { error } = await (supabase as any).from('staff_client_assignments').insert(clientRows);
      if (error) errs.push(error.message);
    }
    if (projectRows.length) {
      const { error } = await (supabase as any).from('staff_project_assignments').insert(projectRows);
      if (error) errs.push(error.message);
    }

    setSaving(false);
    if (errs.length) return toast.error(errs.join('; '));
    toast.success('Assignments updated');
    onSaved?.();
    onOpenChange(false);
  };

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, id: string) => {
    const copy = new Set(set);
    copy.has(id) ? copy.delete(id) : copy.add(id);
    setSet(copy);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Assignments{staffMember ? ` — ${staffMember.full_name}` : ''}</DialogTitle>
          <DialogDescription>Pick which clients and projects this staff member can access (only enforced when scope is set to "assigned" on their role).</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="clients" className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="clients">Clients ({selectedClients.size})</TabsTrigger>
              <TabsTrigger value="projects">Projects ({selectedProjects.size})</TabsTrigger>
            </TabsList>
            <TabsContent value="clients" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[50vh] pr-4">
                <div className="space-y-2 pt-2">
                  {clients.length === 0 && <p className="text-sm text-muted-foreground">No clients yet.</p>}
                  {clients.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox id={c.id} checked={selectedClients.has(c.id)} onCheckedChange={() => toggle(selectedClients, setSelectedClients, c.id)} />
                      <Label htmlFor={c.id} className="cursor-pointer text-sm font-normal flex-1">
                        {c.full_name} <span className="text-muted-foreground">— {c.email}</span>
                        {c.kind === 'managed' && <span className="ml-2 text-xs text-amber-500">(manual)</span>}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="projects" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[50vh] pr-4">
                <div className="space-y-2 pt-2">
                  {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
                  {projects.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox id={p.id} checked={selectedProjects.has(p.id)} onCheckedChange={() => toggle(selectedProjects, setSelectedProjects, p.id)} />
                      <Label htmlFor={p.id} className="cursor-pointer text-sm font-normal flex-1">{p.title}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
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

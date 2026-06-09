import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoleEditorModal, type StaffRoleRecord } from '@/components/staff/RoleEditorModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

const RolesPermissions = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [roles, setRoles] = useState<StaffRoleRecord[]>([]);
  const [agencyId, setAgencyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<StaffRoleRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffRoleRecord | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth/login');
    if (!authLoading && userRole && userRole !== 'admin') navigate('/');
  }, [user, userRole, authLoading, navigate]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ur } = await supabase.from('user_roles').select('agency_id').eq('user_id', user.id).maybeSingle();
    const aid = ur?.agency_id || '';
    setAgencyId(aid);
    if (!aid) { setLoading(false); return; }
    const { data, error } = await (supabase as any)
      .from('staff_roles')
      .select('*')
      .eq('agency_id', aid)
      .order('is_system', { ascending: false })
      .order('name');
    if (error) toast({ title: 'Failed to load roles', description: error.message, variant: 'destructive' });
    setRoles((data as StaffRoleRecord[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchData(); }, [user]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from('staff_roles').delete().eq('id', deleteTarget.id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else toast({ title: 'Role deleted' });
    setDeleteTarget(null);
    fetchData();
  };

  return (
    <>
      <Helmet><title>Roles & Permissions | Veylodesk</title></Helmet>
      <DashboardLayout role="admin">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Roles & Permissions</h1>
                <p className="text-muted-foreground text-sm">Define what your staff can see and do.</p>
              </div>
            </div>
            <Button onClick={() => { setActiveRole(null); setEditorOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> New Role
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : roles.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No roles yet. Create your first one.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {roles.map((r) => {
                const count = Object.values(r.permissions || {}).filter(Boolean).length;
                return (
                  <Card key={r.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="flex items-center gap-2 flex-wrap">
                            {r.name}
                            {r.is_system && <Badge variant="secondary" className="text-xs">System</Badge>}
                            <Badge variant="outline" className="text-xs">{count} permissions</Badge>
                            <Badge variant="outline" className="text-xs">Clients: {r.scope_clients}</Badge>
                            <Badge variant="outline" className="text-xs">Projects: {r.scope_projects}</Badge>
                          </CardTitle>
                          {r.description && <CardDescription className="mt-1">{r.description}</CardDescription>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => { setActiveRole(r); setEditorOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {!r.is_system && (
                            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(r)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <RoleEditorModal open={editorOpen} onOpenChange={setEditorOpen} role={activeRole} agencyId={agencyId} onSaved={fetchData} />

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete role?</AlertDialogTitle>
              <AlertDialogDescription>
                Members currently assigned to "{deleteTarget?.name}" will lose all permissions until reassigned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    </>
  );
};

export default RolesPermissions;

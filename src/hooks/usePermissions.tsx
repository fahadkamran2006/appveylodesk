import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface PermissionsData {
  permissions: Record<string, boolean>;
  scopeClients: 'all' | 'assigned';
  scopeProjects: 'all' | 'assigned';
  assignedClientUserIds: string[];
  assignedManagedClientIds: string[];
  assignedProjectIds: string[];
}

const EMPTY: PermissionsData = {
  permissions: {},
  scopeClients: 'all',
  scopeProjects: 'all',
  assignedClientUserIds: [],
  assignedManagedClientIds: [],
  assignedProjectIds: [],
};

export function usePermissions() {
  const { user, userRole, loading: authLoading } = useAuth();
  const isStaff = userRole === 'staff';
  const isAdmin = userRole === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['staff-permissions', user?.id],
    enabled: !!user && isStaff,
    queryFn: async (): Promise<PermissionsData> => {
      if (!user) return EMPTY;
      const { data: perms } = await supabase.rpc('get_staff_permissions', {
        _user_id: user.id,
      });
      const permObj = (perms as Record<string, any>) || {};

      const [{ data: clientAssign }, { data: projAssign }] = await Promise.all([
        (supabase as any).from('staff_client_assignments').select('client_user_id, managed_client_id').eq('staff_user_id', user.id),
        (supabase as any).from('staff_project_assignments').select('project_id').eq('staff_user_id', user.id),
      ]);

      const out: Record<string, boolean> = {};
      Object.keys(permObj).forEach((k) => {
        if (!k.startsWith('__')) out[k] = !!permObj[k];
      });

      return {
        permissions: out,
        scopeClients: (permObj.__scope_clients as 'all' | 'assigned') || 'all',
        scopeProjects: (permObj.__scope_projects as 'all' | 'assigned') || 'all',
        assignedClientUserIds: (clientAssign || []).map((r: any) => r.client_user_id).filter(Boolean),
        assignedManagedClientIds: (clientAssign || []).map((r: any) => r.managed_client_id).filter(Boolean),
        assignedProjectIds: (projAssign || []).map((r: any) => r.project_id).filter(Boolean),
      };
    },
  });

  const resolved = data ?? EMPTY;

  const can = (key: string): boolean => {
    if (isAdmin) return true;
    if (!isStaff) return false;
    return !!resolved.permissions[key];
  };

  return {
    ...resolved,
    can,
    isStaff,
    isAdmin,
    loading: authLoading || (isStaff && isLoading),
  };
}

interface PermissionGuardProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({ permission, fallback = null, children }: PermissionGuardProps) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

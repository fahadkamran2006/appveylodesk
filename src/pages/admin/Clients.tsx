import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { Button } from '@/components/ui/button';
import { PersonCard } from '@/components/PersonCard';
import { PersonDetailSheet } from '@/components/PersonDetailSheet';
import { InviteUserModal } from '@/components/InviteUserModal';
import { PendingInvitationCard } from '@/components/PendingInvitationCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useClientStats } from '@/hooks/usePersonStats';
import { useAgencyLimits } from '@/hooks/useAgencyLimits';
import { Users, UserPlus, Loader2, Clock, AlertCircle } from 'lucide-react';

interface ClientProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  full_name: string | null;
  role: 'client' | 'editor' | 'admin';
  created_at: string;
  agency_id: string;
}

const AdminClients = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [agencyName, setAgencyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  // Get agency limits for client enforcement
  const { maxClients, currentClients, canAddClient, planTier, loading: limitsLoading } = useAgencyLimits();

  // Fetch real stats for all clients
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { stats: clientStats } = useClientStats(clientIds);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
      navigate(userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchClients = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Get user's agency_id
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRoleData?.agency_id) {
        setIsLoading(false);
        return;
      }

      const agencyId = userRoleData.agency_id;

      // Get agency name
      const { data: agency } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', agencyId)
        .single();
      
      setAgencyName(agency?.name || '');

      // Get all client user_ids in this agency
      const { data: clientRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('agency_id', agencyId)
        .eq('role', 'client');

      const clientUserIds = clientRoles?.map((r) => r.user_id) || [];

      // Get profiles for these users
      if (clientUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, created_at')
          .in('id', clientUserIds);

        setClients(profiles || []);
      } else {
        setClients([]);
      }

      // Get pending client invitations
      const { data: invitations } = await supabase
        .from('agency_invitations')
        .select('id, email, full_name, role, created_at, agency_id')
        .eq('agency_id', agencyId)
        .eq('role', 'client')
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      setPendingInvitations((invitations as PendingInvitation[]) || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchClients();
    }
  }, [user, userRole]);

  const handleExpandClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (client) {
      setSelectedClient(client);
      setDetailOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Clients | Veylodesk</title>
        <meta name="description" content="Manage your agency clients." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <CollapsibleSidebar role="admin" />

        <main className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Clients</h1>
              <p className="text-muted-foreground mt-1">
                Manage your agency clients and their projects
              </p>
            </div>
            {canAddClient() ? (
              <Button
                onClick={() => setInviteOpen(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Client
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      disabled
                      className="bg-primary/50 cursor-not-allowed"
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Limit Reached ({currentClients}/{maxClients})
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>You've reached the client limit for your {planTier} plan. Upgrade to add more clients.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : clients.length === 0 && pendingInvitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No clients yet
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Start building your client base by sending invitations. They'll
                be able to view projects, track progress, and communicate with
                your team.
              </p>
              {canAddClient() ? (
                <Button
                  onClick={() => setInviteOpen(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Your First Client
                </Button>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-destructive mb-2">Client limit reached ({currentClients}/{maxClients})</p>
                  <Button
                    onClick={() => navigate('/admin/settings')}
                    variant="outline"
                  >
                    Upgrade Plan
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Pending Invitations */}
              {pendingInvitations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Pending Invitations ({pendingInvitations.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingInvitations.map((invitation) => (
                      <PendingInvitationCard
                        key={invitation.id}
                        invitation={invitation}
                        agencyName={agencyName}
                        onResend={fetchClients}
                        onCancel={fetchClients}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Active Clients */}
              {clients.length > 0 && (
                <div>
                  {pendingInvitations.length > 0 && (
                    <h2 className="text-lg font-semibold text-foreground mb-4">
                      Active Clients ({clients.length})
                    </h2>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map((client) => {
                      const stats = clientStats[client.id];
                      return (
                        <PersonCard
                          key={client.id}
                          id={client.id}
                          name={client.full_name || ''}
                          email={client.email}
                          avatarUrl={client.avatar_url}
                          variant="client"
                          stats={{
                            activeProjects: stats?.activeProjects ?? 0,
                            totalSpent: stats?.totalSpent ?? 0,
                          }}
                          onExpand={handleExpandClient}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Invite Modal */}
      <InviteUserModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        lockedRole="client"
        onSuccess={fetchClients}
      />

      {/* Detail Sheet */}
      <PersonDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        person={
          selectedClient
            ? {
                id: selectedClient.id,
                name: selectedClient.full_name || '',
                email: selectedClient.email,
                avatarUrl: selectedClient.avatar_url,
                role: 'client',
                createdAt: selectedClient.created_at,
              }
            : null
        }
        variant="client"
        stats={selectedClient ? {
          totalProjects: clientStats[selectedClient.id]?.projects.length ?? 0,
          totalSpent: clientStats[selectedClient.id]?.totalSpent ?? 0,
        } : undefined}
        projects={selectedClient ? clientStats[selectedClient.id]?.projects : undefined}
      />
    </>
  );
};

export default AdminClients;
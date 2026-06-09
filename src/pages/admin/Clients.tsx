import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PersonCard } from '@/components/PersonCard';
import { PersonDetailSheet } from '@/components/PersonDetailSheet';
import { InviteUserModal } from '@/components/InviteUserModal';
import { AddManualClientModal } from '@/components/clients/AddManualClientModal';
import { ActivateClientModal } from '@/components/clients/ActivateClientModal';
import { PendingInvitationCard } from '@/components/PendingInvitationCard';
import { RemoveMemberModal } from '@/components/RemoveMemberModal';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useClientStats, useManagedClientStats } from '@/hooks/usePersonStats';
import { useAgencyLimits } from '@/hooks/useAgencyLimits';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, Loader2, Clock, AlertCircle, KeyRound, Trash2 } from 'lucide-react';

interface ClientProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

interface ManagedClient {
  id: string;
  full_name: string | null;
  email: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  invitation_id: string | null;
  activated_at: string | null;
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
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [managedClients, setManagedClients] = useState<ManagedClient[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [agencyName, setAgencyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addManualOpen, setAddManualOpen] = useState(false);
  const [activateClient, setActivateClient] = useState<ManagedClient | null>(null);
  const [deleteManaged, setDeleteManaged] = useState<ManagedClient | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [clientToRemove, setClientToRemove] = useState<ClientProfile | null>(null);
  
  
  // Get agency limits for client enforcement
  const { maxClients, currentClients, canAddClient, planTier, loading: limitsLoading } = useAgencyLimits();

  // Fetch real stats for all clients
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { stats: clientStats } = useClientStats(clientIds);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin' && userRole !== 'staff') {
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

      // Get managed (manual, not-yet-activated) clients
      const { data: managed } = await supabase
        .from('managed_clients')
        .select('id, full_name, email, company, phone, notes, created_at, invitation_id, activated_at')
        .eq('agency_id', agencyId)
        .is('converted_profile_id', null)
        .order('created_at', { ascending: false });

      setManagedClients((managed as ManagedClient[]) || []);
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

  const handleRemoveClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (client) {
      setClientToRemove(client);
      setRemoveModalOpen(true);
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
        <div className="hidden md:block">
          <CollapsibleSidebar role="admin" />
        </div>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Clients</h1>
              <p className="text-muted-foreground mt-1">
                Manage your agency clients and their projects
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddManualOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Manually
              </Button>
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
                      <Button disabled className="bg-primary/50 cursor-not-allowed">
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
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : clients.length === 0 && pendingInvitations.length === 0 && managedClients.length === 0 ? (
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
                          onRemove={handleRemoveClient}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Manual (Managed) Clients */}
              {managedClients.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Manual Clients ({managedClients.length})
                    </h2>
                    <Badge variant="outline" className="text-xs">No dashboard access</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {managedClients.map((mc) => {
                      const initials = (mc.full_name || mc.email)
                        .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
                      const invited = !!mc.invitation_id;
                      return (
                        <Card key={mc.id} className="p-5 glass-card border-border/50 hover:border-primary/40 transition">
                          <div className="flex items-start gap-3 mb-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-foreground truncate">
                                {mc.full_name || mc.email}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3 shrink-0" /> {mc.email}
                              </div>
                            </div>
                            {invited && (
                              <Badge variant="secondary" className="text-xs shrink-0">Invited</Badge>
                            )}
                          </div>
                          {(mc.company || mc.phone) && (
                            <div className="space-y-1 text-xs text-muted-foreground mb-3">
                              {mc.company && <div className="flex items-center gap-1"><Building2 className="w-3 h-3" />{mc.company}</div>}
                              {mc.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{mc.phone}</div>}
                            </div>
                          )}
                          {mc.notes && (
                            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{mc.notes}</p>
                          )}
                          <div className="flex gap-2 pt-2 border-t border-border/40">
                            <Button
                              size="sm"
                              className="flex-1 bg-primary hover:bg-primary/90"
                              onClick={() => setActivateClient(mc)}
                              disabled={invited}
                            >
                              <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                              {invited ? 'Invite Sent' : 'Give Access'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteManaged(mc)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </Card>
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

      {/* Remove Client Modal */}
      <RemoveMemberModal
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        member={clientToRemove ? {
          id: clientToRemove.id,
          name: clientToRemove.full_name,
          email: clientToRemove.email,
          avatarUrl: clientToRemove.avatar_url,
        } : null}
        memberType="client"
        onSuccess={fetchClients}
      />
      <MobileBottomNav role="admin" />

      {/* Add Manual Client Modal */}
      <AddManualClientModal
        open={addManualOpen}
        onOpenChange={setAddManualOpen}
        onSuccess={fetchClients}
      />

      {/* Activate Managed Client */}
      <ActivateClientModal
        open={!!activateClient}
        onOpenChange={(o) => !o && setActivateClient(null)}
        client={activateClient}
        onSuccess={fetchClients}
      />

      {/* Delete Managed Client confirm */}
      <AlertDialog open={!!deleteManaged} onOpenChange={(o) => !o && setDeleteManaged(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete manual client?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deleteManaged?.full_name || deleteManaged?.email} from your client list. Their projects and invoices will be unlinked but kept. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteManaged) return;
                const { error } = await supabase.from('managed_clients').delete().eq('id', deleteManaged.id);
                if (error) {
                  toast({ title: 'Error', description: error.message, variant: 'destructive' });
                } else {
                  toast({ title: 'Client deleted' });
                  fetchClients();
                }
                setDeleteManaged(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminClients;
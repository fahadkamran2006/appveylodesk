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
import { EditorLeaderboard } from '@/components/admin/EditorLeaderboard';
import { supabase } from '@/integrations/supabase/client';
import { useEditorStats, type TimePeriod } from '@/hooks/usePersonStats';
import { UsersRound, UserPlus, Loader2, Clock } from 'lucide-react';

interface TeamMember {
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
  role: 'admin' | 'editor' | 'client';
  created_at: string;
  agency_id: string;
}

const AdminTeam = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [agencyName, setAgencyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<TimePeriod>('all');

  // Fetch real stats for all editors
  const editorIds = useMemo(() => teamMembers.map(m => m.id), [teamMembers]);
  const { stats: editorStats } = useEditorStats(editorIds, leaderboardPeriod);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
      navigate(userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchTeamData = async () => {
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

      // Fetch agency name, editor profiles, and pending invitations in parallel
      const [agencyResult, editorRolesResult, invitationsResult] = await Promise.all([
        supabase.from('agencies').select('name').eq('id', agencyId).maybeSingle(),
        supabase.from('user_roles').select('user_id').eq('agency_id', agencyId).eq('role', 'editor'),
        supabase.from('agency_invitations').select('*').eq('agency_id', agencyId).eq('role', 'editor').is('accepted_at', null),
      ]);

      setAgencyName(agencyResult.data?.name || '');
      setPendingInvitations((invitationsResult.data as PendingInvitation[]) || []);

      // Get profiles for editors
      if (editorRolesResult.data && editorRolesResult.data.length > 0) {
        const editorUserIds = editorRolesResult.data.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, created_at')
          .in('id', editorUserIds);
        setTeamMembers(profiles || []);
      } else {
        setTeamMembers([]);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchTeamData();
    }
  }, [user, userRole]);

  const handleExpandMember = (id: string) => {
    const member = teamMembers.find((m) => m.id === id);
    if (member) {
      setSelectedMember(member);
      setDetailOpen(true);
    }
  };

  const handleInvitationChange = () => {
    fetchTeamData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const hasContent = teamMembers.length > 0 || pendingInvitations.length > 0;

  return (
    <>
      <Helmet>
        <title>Team | Veylodesk</title>
        <meta name="description" content="Manage your agency team members." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <CollapsibleSidebar role="admin" />

        <main className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Team</h1>
              <p className="text-muted-foreground mt-1">
                Manage your editors and team members
              </p>
            </div>
            <Button
              onClick={() => setInviteOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !hasContent ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <UsersRound className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No team members yet
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Build your team by inviting editors. They'll be able to work on
                projects, communicate with clients, and track their earnings.
              </p>
              <Button
                onClick={() => setInviteOpen(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Your First Team Member
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Editor Leaderboard */}
              {teamMembers.length > 0 && Object.keys(editorStats).length > 0 && (
                <section>
                  <EditorLeaderboard 
                    editors={teamMembers} 
                    stats={editorStats} 
                    period={leaderboardPeriod}
                    onPeriodChange={setLeaderboardPeriod}
                  />
                </section>
              )}

              {/* Pending Invitations */}
              {pendingInvitations.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Pending Invitations
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      ({pendingInvitations.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingInvitations.map((invitation) => (
                      <PendingInvitationCard
                        key={invitation.id}
                        invitation={invitation}
                        agencyName={agencyName}
                        onResend={handleInvitationChange}
                        onCancel={handleInvitationChange}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Active Team Members */}
              {teamMembers.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <UsersRound className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Active Team Members
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      ({teamMembers.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teamMembers.map((member) => {
                      const stats = editorStats[member.id];
                      return (
                        <PersonCard
                          key={member.id}
                          id={member.id}
                          name={member.full_name || ''}
                          email={member.email}
                          avatarUrl={member.avatar_url}
                          role="editor"
                          variant="team"
                          stats={{
                            currentLoad: stats?.currentLoad ?? 0,
                            status: (stats?.currentLoad ?? 0) > 0 ? 'active' : 'offline',
                          }}
                          onExpand={handleExpandMember}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Invite Modal */}
      <InviteUserModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        lockedRole="editor"
        onSuccess={fetchTeamData}
      />

      {/* Detail Sheet */}
      <PersonDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        person={
          selectedMember
            ? {
                id: selectedMember.id,
                name: selectedMember.full_name || '',
                email: selectedMember.email,
                avatarUrl: selectedMember.avatar_url,
                role: 'editor',
                createdAt: selectedMember.created_at,
              }
            : null
        }
        variant="team"
        stats={selectedMember ? {
          completedTasks: editorStats[selectedMember.id]?.completedProjects ?? 0,
          totalProjects: editorStats[selectedMember.id]?.projects.length ?? 0,
          avgDeliveryDays: editorStats[selectedMember.id]?.avgDeliveryDays,
        } : undefined}
        projects={selectedMember ? editorStats[selectedMember.id]?.projects : undefined}
      />
    </>
  );
};

export default AdminTeam;
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { PersonCard } from '@/components/PersonCard';
import { InviteUserModal } from '@/components/InviteUserModal';
import { PendingInvitationCard } from '@/components/PendingInvitationCard';
import { EditorLeaderboard } from '@/components/admin/EditorLeaderboard';
import { TodayAttendance } from '@/components/admin/TodayAttendance';
import { RemoveMemberModal } from '@/components/RemoveMemberModal';
import { EditEditorModal } from '@/components/admin/EditEditorModal';
import { supabase } from '@/integrations/supabase/client';
import { useEditorStats, type TimePeriod } from '@/hooks/usePersonStats';
import { UsersRound, UserPlus, Loader2, Clock, CalendarDays } from 'lucide-react';
import { LeaveManagement } from '@/components/admin/LeaveManagement';
import type { Database } from '@/integrations/supabase/types';

type EmploymentType = Database['public']['Enums']['employment_type'];

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  employment_type: EmploymentType;
  monthly_salary: number | null;
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
  const [agencyId, setAgencyId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<TimePeriod>('all');
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editorToEdit, setEditorToEdit] = useState<TeamMember | null>(null);

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

      const agencyIdVal = userRoleData.agency_id;
      setAgencyId(agencyIdVal);
      // Fetch agency name, editor profiles, and pending invitations in parallel
      const [agencyResult, editorRolesResult, invitationsResult] = await Promise.all([
        supabase.from('agencies').select('name').eq('id', agencyIdVal).maybeSingle(),
        supabase.from('user_roles').select('user_id').eq('agency_id', agencyIdVal).eq('role', 'editor'),
        supabase.from('agency_invitations').select('*').eq('agency_id', agencyIdVal).eq('role', 'editor').is('accepted_at', null),
      ]);

      setAgencyName(agencyResult.data?.name || '');
      setPendingInvitations((invitationsResult.data as PendingInvitation[]) || []);

      // Get profiles for editors
      if (editorRolesResult.data && editorRolesResult.data.length > 0) {
        const editorUserIds = editorRolesResult.data.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, created_at, employment_type, monthly_salary')
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
    navigate(`/admin/team/${id}`);
  };

  const handleRemoveMember = (id: string) => {
    const member = teamMembers.find((m) => m.id === id);
    if (member) {
      setMemberToRemove(member);
      setRemoveModalOpen(true);
    }
  };

  const handleInvitationChange = () => {
    fetchTeamData();
  };

  const handleEditMember = (id: string) => {
    const member = teamMembers.find((m) => m.id === id);
    if (member) {
      setEditorToEdit(member);
      setEditModalOpen(true);
    }
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
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <CollapsibleSidebar role="admin" />
        </div>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Team</h1>
              <p className="text-muted-foreground mt-1">
                Manage your editors and team members
              </p>
            </div>
            <Button
              onClick={() => setInviteOpen(true)}
              className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
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
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
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
                  {/* Mobile: Single column, Desktop: Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
                  {/* Mobile: Single column, Desktop: Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
                          employmentType={member.employment_type}
                          stats={{
                            currentLoad: stats?.currentLoad ?? 0,
                            status: (stats?.currentLoad ?? 0) > 0 ? 'active' : 'offline',
                          }}
                          onExpand={handleExpandMember}
                          onRemove={handleRemoveMember}
                          onEdit={handleEditMember}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Leave Requests */}
              {agencyId && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarDays className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">Leave Requests</h2>
                  </div>
                  <div className="glass-card rounded-xl p-6">
                    <LeaveManagement agencyId={agencyId} />
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


      {/* Edit Editor Modal */}
      <EditEditorModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        editor={editorToEdit}
        onSuccess={fetchTeamData}
      />

      {/* Remove Member Modal */}
      <RemoveMemberModal
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        member={memberToRemove ? {
          id: memberToRemove.id,
          name: memberToRemove.full_name,
          email: memberToRemove.email,
          avatarUrl: memberToRemove.avatar_url,
        } : null}
        memberType="editor"
        onSuccess={fetchTeamData}
      />
      <MobileBottomNav role="admin" />
    </>
  );
};

export default AdminTeam;
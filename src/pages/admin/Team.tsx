import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { PersonCard } from '@/components/PersonCard';
import { PersonDetailSheet } from '@/components/PersonDetailSheet';
import { InviteUserModal } from '@/components/InviteUserModal';
import { supabase } from '@/integrations/supabase/client';
import { UsersRound, UserPlus, Loader2 } from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

const AdminTeam = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
      navigate(userRole === 'client' ? '/client/portal' : '/editor/workspace');
    }
  }, [user, userRole, loading, navigate]);

  const fetchTeamMembers = async () => {
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

      // Get all editor user_ids in this agency
      const { data: editorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('agency_id', userRoleData.agency_id)
        .eq('role', 'editor');

      if (!editorRoles || editorRoles.length === 0) {
        setTeamMembers([]);
        setIsLoading(false);
        return;
      }

      const editorUserIds = editorRoles.map((r) => r.user_id);

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, created_at')
        .in('id', editorUserIds);

      setTeamMembers(profiles || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchTeamMembers();
    }
  }, [user, userRole]);

  const handleExpandMember = (id: string) => {
    const member = teamMembers.find((m) => m.id === id);
    if (member) {
      setSelectedMember(member);
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
        <title>Team | Veylodesk</title>
        <meta name="description" content="Manage your agency team members." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <AppSidebar role="admin" />

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
          ) : teamMembers.length === 0 ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamMembers.map((member) => (
                <PersonCard
                  key={member.id}
                  id={member.id}
                  name={member.full_name || ''}
                  email={member.email}
                  avatarUrl={member.avatar_url}
                  role="editor"
                  variant="team"
                  stats={{
                    currentLoad: Math.floor(Math.random() * 8),
                    status: Math.random() > 0.3 ? 'active' : 'offline',
                  }}
                  onExpand={handleExpandMember}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Invite Modal */}
      <InviteUserModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        lockedRole="editor"
        onSuccess={fetchTeamMembers}
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
      />
    </>
  );
};

export default AdminTeam;
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserPlus, UserMinus, Loader2, Users } from 'lucide-react';

interface Participant {
  user_id: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface AvailableUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: 'admin' | 'editor' | 'client';
}

interface ManageParticipantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  participants: Participant[];
  agencyId: string | null;
  onParticipantsChanged: () => void;
}

export function ManageParticipantsModal({
  open,
  onOpenChange,
  channelId,
  participants,
  agencyId,
  onParticipantsChanged,
}: ManageParticipantsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingUser, setAddingUser] = useState<string | null>(null);
  const [removingUser, setRemovingUser] = useState<string | null>(null);

  // Fetch available users (admins and editors in the agency, not already in channel)
  useEffect(() => {
    const fetchAvailableUsers = async () => {
      if (!agencyId || !open) return;

      setLoading(true);
      try {
        // Get all users in the agency (admins and editors)
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('agency_id', agencyId)
          .in('role', ['admin', 'editor']);

        if (roleError) throw roleError;

        const userIds = roleData?.map(r => r.user_id) || [];
        const participantIds = participants.map(p => p.user_id);

        // Filter out users already in the channel
        const availableUserIds = userIds.filter(id => !participantIds.includes(id));

        if (availableUserIds.length === 0) {
          setAvailableUsers([]);
          return;
        }

        // Fetch profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', availableUserIds);

        if (profilesError) throw profilesError;

        // Map with roles
        const usersWithRoles: AvailableUser[] = (profiles || []).map(p => ({
          ...p,
          role: roleData?.find(r => r.user_id === p.id)?.role as 'admin' | 'editor' | 'client',
        }));

        setAvailableUsers(usersWithRoles);
      } catch (error) {
        console.error('Error fetching available users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableUsers();
  }, [agencyId, open, participants]);

  const getInitials = (name: string | null, email: string) => {
    const displayName = name || email;
    return displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAddUser = async (userId: string) => {
    setAddingUser(userId);
    try {
      const { error } = await supabase
        .from('channel_participants')
        .insert({
          channel_id: channelId,
          user_id: userId,
        });

      if (error) throw error;

      toast({
        title: 'User added',
        description: 'They can now participate in this chat.',
      });

      onParticipantsChanged();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add user',
        variant: 'destructive',
      });
    } finally {
      setAddingUser(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    // Don't allow removing yourself
    if (userId === user?.id) {
      toast({
        title: 'Cannot remove yourself',
        description: 'You cannot remove yourself from the chat.',
        variant: 'destructive',
      });
      return;
    }

    setRemovingUser(userId);
    try {
      const { error } = await supabase
        .from('channel_participants')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'User removed',
        description: 'They will no longer see new messages.',
      });

      onParticipantsChanged();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove user',
        variant: 'destructive',
      });
    } finally {
      setRemovingUser(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Manage Participants
          </DialogTitle>
          <DialogDescription>
            Add or remove team members from this chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Participants */}
          <div>
            <h4 className="text-sm font-medium mb-3">Current Participants ({participants.length})</h4>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {participants.map((participant) => {
                  const isCurrentUser = participant.user_id === user?.id;
                  return (
                    <div
                      key={participant.user_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={participant.profile.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-primary/20 text-primary">
                            {getInitials(participant.profile.full_name, participant.profile.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {participant.profile.full_name || participant.profile.email}
                            {isCurrentUser && <span className="text-muted-foreground"> (you)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {participant.profile.email}
                          </p>
                        </div>
                      </div>
                      {!isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveUser(participant.user_id)}
                          disabled={removingUser === participant.user_id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {removingUser === participant.user_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserMinus className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Available Users to Add */}
          <div>
            <h4 className="text-sm font-medium mb-3">Add Team Members</h4>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All team members are already in this chat.
              </p>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {availableUsers.map((availableUser) => (
                    <div
                      key={availableUser.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={availableUser.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                            {getInitials(availableUser.full_name, availableUser.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {availableUser.full_name || availableUser.email}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {availableUser.role}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAddUser(availableUser.id)}
                        disabled={addingUser === availableUser.id}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        {addingUser === availableUser.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

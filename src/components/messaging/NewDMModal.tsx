import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Search, Loader2 } from 'lucide-react';

interface User {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: 'admin' | 'client' | 'editor' | 'staff';
}

interface NewDMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string | null;
  onSelectUser: (userId: string) => Promise<void>;
}

export function NewDMModal({ open, onOpenChange, agencyId, onSelectUser }: NewDMModalProps) {
  const { user, userRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!agencyId || !user) return;

      setLoading(true);
      try {
        // Get all users in the agency with their roles
        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('agency_id', agencyId)
          .neq('user_id', user.id);

        if (error) throw error;

        // Get profiles for these users
        const userIds = userRoles?.map(ur => ur.user_id) || [];
        
        if (userIds.length === 0) {
          setUsers([]);
          return;
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);

        // Combine with roles
        const usersWithRoles: User[] = (profiles || []).map(profile => ({
          ...profile,
          role: userRoles?.find(ur => ur.user_id === profile.id)?.role || 'client',
        }));

        // Filter based on DM rules:
        // - Admin can DM anyone
        // - Client/Editor can only DM admin
        let filteredUsers = usersWithRoles;
        if (userRole !== 'admin') {
          filteredUsers = usersWithRoles.filter(u => u.role === 'admin');
        }

        setUsers(filteredUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchUsers();
    }
  }, [open, agencyId, user?.id, userRole]);

  const getInitials = (name: string | null, email: string) => {
    const displayName = name || email;
    return displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSelect = async (userId: string) => {
    setSelecting(userId);
    try {
      await onSelectUser(userId);
      onOpenChange(false);
    } finally {
      setSelecting(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const searchLower = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(searchLower) ||
      u.email.toLowerCase().includes(searchLower)
    );
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'client':
        return 'secondary';
      case 'editor':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <MessageSquare className="w-5 h-5 text-primary" />
            New Message
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {userRole === 'admin'
              ? 'Start a conversation with a team member or client'
              : 'Contact your admin for support'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-9 bg-surface-elevated border-border/50"
            />
          </div>

          {/* User List */}
          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <div className="text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {users.length === 0
                      ? 'No users available to message'
                      : 'No users match your search'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((u) => (
                  <Button
                    key={u.id}
                    variant="ghost"
                    className="w-full justify-start h-auto py-3"
                    onClick={() => handleSelect(u.id)}
                    disabled={selecting !== null}
                  >
                    <Avatar className="w-10 h-10 mr-3 border border-border/50">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-sm">
                        {getInitials(u.full_name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {u.full_name || u.email}
                        </span>
                        <Badge variant={getRoleBadgeVariant(u.role)} className="text-[10px] capitalize">
                          {u.role}
                        </Badge>
                      </div>
                      {u.full_name && (
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      )}
                    </div>
                    {selecting === u.id && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

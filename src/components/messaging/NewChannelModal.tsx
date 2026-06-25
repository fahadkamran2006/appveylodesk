import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Hash, Search, Loader2 } from 'lucide-react';

interface AgencyUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: 'admin' | 'client' | 'editor' | 'staff';
}

interface NewChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string | null;
  groupId?: string | null;
  groupName?: string | null;
  onCreate: (name: string, participantIds: string[], groupId?: string | null) => Promise<string | null>;
}


export function NewChannelModal({ open, onOpenChange, agencyId, groupId, groupName, onCreate }: NewChannelModalProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<AgencyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setSelected(new Set());
      setSearch('');
      return;
    }
    const fetchUsers = async () => {
      if (!agencyId || !user) return;
      setLoading(true);
      try {
        const { data: roles, error } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('agency_id', agencyId)
          .neq('user_id', user.id);
        if (error) throw error;

        const ids = roles?.map(r => r.user_id) || [];
        if (ids.length === 0) {
          setUsers([]);
          return;
        }
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', ids);

        const list: AgencyUser[] = (profiles || []).map(p => ({
          ...p,
          role: (roles?.find(r => r.user_id === p.id)?.role as AgencyUser['role']) || 'client',
        }));
        setUsers(list);
      } catch (e) {
        console.error('Error loading agency users:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [open, agencyId, user?.id]);

  const initials = (n: string | null, e: string) =>
    (n || e).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const id = await onCreate(trimmed, Array.from(selected), groupId ?? null);
      if (id) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };


  const roleBadge = (r: string) => {
    switch (r) {
      case 'admin': return 'default';
      case 'client': return 'secondary';
      case 'editor': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Hash className="w-5 h-5 text-primary" />
            New Channel
          </DialogTitle>
          <DialogDescription>
            {groupName
              ? <>Create a channel inside <span className="font-medium text-foreground">{groupName}</span> and add people from your agency.</>
              : 'Create a custom channel and add people from your agency.'}
          </DialogDescription>

        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Channel name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. marketing-team"
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Add members ({selected.size} selected)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team, clients, staff..."
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[260px] rounded-md border border-border/50">
              {loading ? (
                <div className="h-[260px] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                  No users found
                </div>
              ) : (
                <ul className="p-1">
                  {filtered.map(u => {
                    const checked = selected.has(u.id);
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => toggle(u.id)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/60 text-left"
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggle(u.id)} />
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {initials(u.full_name, u.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {u.full_name || u.email}
                              </span>
                              <Badge variant={roleBadge(u.role) as any} className="text-[10px] capitalize">
                                {u.role}
                              </Badge>
                            </div>
                            {u.full_name && (
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

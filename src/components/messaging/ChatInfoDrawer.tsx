import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Users, UserPlus, UserMinus, LogOut, Image, Link2, Loader2, ExternalLink,
} from 'lucide-react';

interface Participant {
  user_id: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface Channel {
  id: string;
  type: 'dm' | 'project';
  name: string | null;
  is_archived: boolean;
  participants: Participant[];
  project?: { id: string; title: string; status: string } | null;
}

interface MediaItem {
  id: string;
  attachment_url: string;
  attachment_type: string;
  created_at: string;
  sender_name: string;
}

interface LinkItem {
  id: string;
  url: string;
  content: string;
  created_at: string;
  sender_name: string;
}

interface ChatInfoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
  agencyId: string | null;
  onParticipantsChanged: () => void;
}

function getInitials(name: string | null, email: string) {
  const d = name || email || 'U';
  return d.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Extract URLs from text
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  return text.match(urlRegex) || [];
}

export function ChatInfoDrawer({
  open, onOpenChange, channel, agencyId, onParticipantsChanged,
}: ChatInfoDrawerProps) {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingUser, setAddingUser] = useState<string | null>(null);
  const [removingUser, setRemovingUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('members');

  const isAdmin = userRole === 'admin';
  const isDM = channel.type === 'dm';

  // Fetch shared media
  useEffect(() => {
    if (!open || activeTab !== 'media') return;
    const fetch = async () => {
      setLoadingMedia(true);
      const { data } = await supabase
        .from('messages')
        .select('id, attachment_url, attachment_type, created_at, sender_id')
        .eq('channel_id', channel.id)
        .not('attachment_url', 'is', null)
        .in('attachment_type', ['image', 'video'])
        .order('created_at', { ascending: false });

      if (data) {
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', senderIds);

        setMedia(data.map(m => ({
          id: m.id,
          attachment_url: m.attachment_url!,
          attachment_type: m.attachment_type!,
          created_at: m.created_at,
          sender_name: profiles?.find(p => p.id === m.sender_id)?.full_name || 'User',
        })));
      }
      setLoadingMedia(false);
    };
    fetch();
  }, [open, activeTab, channel.id]);

  // Fetch shared links
  useEffect(() => {
    if (!open || activeTab !== 'links') return;
    const fetch = async () => {
      setLoadingLinks(true);
      const { data } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('channel_id', channel.id)
        .or('content.ilike.%http://%,content.ilike.%https://%')
        .order('created_at', { ascending: false });

      if (data) {
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', senderIds);

        const linkItems: LinkItem[] = [];
        data.forEach(m => {
          const urls = extractUrls(m.content);
          urls.forEach(url => {
            linkItems.push({
              id: m.id + url,
              url,
              content: m.content,
              created_at: m.created_at,
              sender_name: profiles?.find(p => p.id === m.sender_id)?.full_name || 'User',
            });
          });
        });
        setLinks(linkItems);
      }
      setLoadingLinks(false);
    };
    fetch();
  }, [open, activeTab, channel.id]);

  // Fetch available users to add
  useEffect(() => {
    if (!open || !isAdmin || isDM || !agencyId) return;
    const fetch = async () => {
      setLoadingUsers(true);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('agency_id', agencyId);

      if (roles) {
        const participantIds = channel.participants.map(p => p.user_id);
        const available = roles.filter(r => !participantIds.includes(r.user_id));

        if (available.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', available.map(u => u.user_id));

          setAvailableUsers((profiles || []).map(p => ({
            ...p,
            role: roles.find(r => r.user_id === p.id)?.role,
          })));
        } else {
          setAvailableUsers([]);
        }
      }
      setLoadingUsers(false);
    };
    fetch();
  }, [open, isAdmin, isDM, agencyId, channel.participants]);

  const handleAddUser = async (userId: string) => {
    setAddingUser(userId);
    try {
      const { error } = await supabase.from('channel_participants').insert({
        channel_id: channel.id, user_id: userId,
      });
      if (error) throw error;
      toast({ title: 'Member added' });
      onParticipantsChanged();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setAddingUser(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    setRemovingUser(userId);
    try {
      const { error } = await supabase.from('channel_participants')
        .delete().eq('channel_id', channel.id).eq('user_id', userId);
      if (error) throw error;
      toast({ title: 'Member removed' });
      onParticipantsChanged();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRemovingUser(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from('channel_participants')
        .delete().eq('channel_id', channel.id).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'You left the group' });
      onParticipantsChanged();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {isDM ? 'Chat Info' : ((channel as any).container?.title || channel.name || 'Group Info')}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mb-2">
            <TabsTrigger value="members" className="flex-1 gap-1.5">
              <Users className="w-3.5 h-3.5" /> Members
            </TabsTrigger>
            <TabsTrigger value="media" className="flex-1 gap-1.5">
              <Image className="w-3.5 h-3.5" /> Media
            </TabsTrigger>
            <TabsTrigger value="links" className="flex-1 gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Links
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full px-6 pb-6">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Participants ({channel.participants.length})
                </h4>
                {channel.participants.map(p => {
                  const isCurrentUser = p.user_id === user?.id;
                  return (
                    <div key={p.user_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={p.profile.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-primary/20 text-primary">
                            {getInitials(p.profile.full_name, p.profile.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {p.profile.full_name || p.profile.email}
                            {isCurrentUser && <span className="text-muted-foreground"> (you)</span>}
                          </p>
                        </div>
                      </div>
                      {isAdmin && !isCurrentUser && !isDM && (
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleRemoveUser(p.user_id)}
                          disabled={removingUser === p.user_id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {removingUser === p.user_id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <UserMinus className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Members Section (Admin only, group chats) */}
              {isAdmin && !isDM && (
                <>
                  <Separator className="my-4" />
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Add Members</h4>
                  {loadingUsers ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      All team members are in this chat.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={u.avatar_url || undefined} />
                              <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                                {getInitials(u.full_name, u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{u.role}</Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleAddUser(u.id)}
                            disabled={addingUser === u.id}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            {addingUser === u.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <UserPlus className="w-4 h-4" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Leave Group Button */}
              {!isDM && (
                <>
                  <Separator className="my-4" />
                  <Button
                    variant="outline"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={handleLeaveGroup}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Leave Group
                  </Button>
                </>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full px-6 pb-6">
              {loadingMedia ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : media.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No shared media</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {media.map(item => (
                    <a
                      key={item.id}
                      href={item.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                    >
                      {item.attachment_type === 'image' ? (
                        <img
                          src={item.attachment_url}
                          alt="Shared media"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={item.attachment_url}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </a>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Links Tab */}
          <TabsContent value="links" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full px-6 pb-6">
              {loadingLinks ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : links.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No shared links</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map(item => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        <ExternalLink className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-primary truncate group-hover:underline">{item.url}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Shared by {item.sender_name}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

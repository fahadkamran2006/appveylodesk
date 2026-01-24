import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageSquare, Users, FolderKanban, Lock, Plus, ChevronDown, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

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
  updated_at: string;
  participants: Participant[];
  project?: {
    id: string;
    title: string;
    status: string;
  } | null;
  last_message?: {
    content: string;
    created_at: string;
  } | null;
}

interface ChatListProps {
  dmChannels: Channel[];
  projectChannels: Channel[];
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onNewDM?: () => void;
  loading?: boolean;
  unreadCounts?: { [channelId: string]: number };
}

export function ChatList({
  dmChannels,
  projectChannels,
  selectedChannelId,
  onSelectChannel,
  onNewDM,
  loading,
  unreadCounts = {},
}: ChatListProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dm' | 'project'>('dm');
  const [showArchived, setShowArchived] = useState(false);

  // Sort channels by last message time (most recent first)
  const sortByRecency = (a: Channel, b: Channel) => {
    const aTime = a.last_message?.created_at || a.updated_at;
    const bTime = b.last_message?.created_at || b.updated_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  };

  // Sort DM channels by recency
  const sortedDmChannels = [...dmChannels].sort(sortByRecency);

  // Separate active and archived project channels, sorted by recency
  const activeProjectChannels = projectChannels.filter(c => !c.is_archived).sort(sortByRecency);
  const archivedProjectChannels = projectChannels.filter(c => c.is_archived).sort(sortByRecency);

  const getOtherParticipant = (channel: Channel) => {
    return channel.participants.find(p => p.user_id !== user?.id)?.profile;
  };

  const getInitials = (name: string | null, email: string) => {
    const displayName = name || email;
    return displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderChannelItem = (channel: Channel) => {
    const isSelected = channel.id === selectedChannelId;
    const isDM = channel.type === 'dm';
    const otherUser = isDM ? getOtherParticipant(channel) : null;
    const displayName = isDM
      ? otherUser?.full_name || 'User'
      : channel.project?.title || channel.name || 'Project Chat';
    const unreadCount = unreadCounts[channel.id] || 0;

    return (
      <button
        key={channel.id}
        onClick={() => onSelectChannel(channel.id)}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
          isSelected
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-muted/50 text-foreground'
        )}
      >
        {/* Avatar */}
        {isDM ? (
          <Avatar className="w-10 h-10 border border-border/50">
            <AvatarImage src={otherUser?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-sm">
              {getInitials(otherUser?.full_name || null, otherUser?.email || '')}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            channel.is_archived ? "bg-muted" : "bg-secondary"
          )}>
            <FolderKanban className="w-5 h-5 text-muted-foreground" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium truncate",
              channel.is_archived && "text-muted-foreground"
            )}>
              {displayName}
            </span>
            {channel.is_archived && (
              <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          {channel.last_message && (
            <p className="text-sm text-muted-foreground truncate">
              {channel.last_message.content}
            </p>
          )}
        </div>

        {/* Time & Unread Badge */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {channel.last_message && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(channel.last_message.created_at), {
                addSuffix: false,
              })}
            </span>
          )}
          {unreadCount > 0 && (
            <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 min-w-[20px] text-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'dm' | 'project')} className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border/50">
          <TabsList className="w-full">
            <TabsTrigger value="dm" className="flex-1 gap-2">
              <MessageSquare className="w-4 h-4" />
              Direct
              {dmChannels.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {dmChannels.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="project" className="flex-1 gap-2">
              <FolderKanban className="w-4 h-4" />
              Projects
              {activeProjectChannels.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeProjectChannels.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dm" className="flex-1 m-0 overflow-hidden">
          <div className="p-2">
            {onNewDM && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mb-2"
                onClick={onNewDM}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Message
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1 px-2">
            {sortedDmChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No direct messages yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sortedDmChannels.map(renderChannelItem)}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="project" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="flex-1 px-2 pt-2">
            {projectChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderKanban className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No project chats yet</p>
                <p className="text-xs mt-1">Chats are created when you're added to projects</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Active project chats */}
                {activeProjectChannels.map(renderChannelItem)}

                {/* Archived section */}
                {archivedProjectChannels.length > 0 && (
                  <Collapsible open={showArchived} onOpenChange={setShowArchived} className="mt-4">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Archive className="w-4 h-4" />
                          <span>Archived ({archivedProjectChannels.length})</span>
                        </div>
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform",
                          showArchived && "rotate-180"
                        )} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1">
                      {archivedProjectChannels.map(renderChannelItem)}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

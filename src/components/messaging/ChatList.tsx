import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Users, FolderKanban, Lock, Plus } from 'lucide-react';
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
}

export function ChatList({
  dmChannels,
  projectChannels,
  selectedChannelId,
  onSelectChannel,
  onNewDM,
  loading,
}: ChatListProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dm' | 'project'>('dm');

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
      ? otherUser?.full_name || otherUser?.email || 'Unknown'
      : channel.project?.title || channel.name || 'Project Chat';

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
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-muted-foreground" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{displayName}</span>
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

        {/* Time */}
        {channel.last_message && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatDistanceToNow(new Date(channel.last_message.created_at), {
              addSuffix: false,
            })}
          </span>
        )}
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
              {projectChannels.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {projectChannels.length}
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
            {dmChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No direct messages yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {dmChannels.map(renderChannelItem)}
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
                {projectChannels.map(renderChannelItem)}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

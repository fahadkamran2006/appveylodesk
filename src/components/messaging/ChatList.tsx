import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MessageSquare, Hash, Plus, Trash2, Search, ChevronDown } from 'lucide-react';
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
  type: 'dm' | 'project' | 'custom';
  name: string | null;
  is_archived: boolean;
  updated_at: string;
  participants: Participant[];
  container?: {
    id: string;
    title: string;
  } | null;
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
  onNewChannel?: () => void;
  onDeleteChannel?: (channelId: string) => Promise<boolean>;
  onChannelDeleted?: () => void;
  loading?: boolean;
  unreadCounts?: { [channelId: string]: number };
  isUserOnline?: (userId: string) => boolean;
}

export function ChatList({
  dmChannels,
  projectChannels,
  selectedChannelId,
  onSelectChannel,
  onNewDM,
  onDeleteChannel,
  onChannelDeleted,
  loading,
  unreadCounts = {},
  isUserOnline,
}: ChatListProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteChannelTarget, setDeleteChannelTarget] = useState<Channel | null>(null);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);
  const [dmExpanded, setDmExpanded] = useState(true);
  const [projectExpanded, setProjectExpanded] = useState(true);

  const sortByRecency = (a: Channel, b: Channel) => {
    const aTime = a.last_message?.created_at || a.updated_at;
    const bTime = b.last_message?.created_at || b.updated_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  };

  const getOtherParticipant = (channel: Channel) => {
    return channel.participants.find(p => p.user_id !== user?.id)?.profile;
  };

  const getChannelName = (channel: Channel) => {
    if (channel.type === 'dm') {
      return getOtherParticipant(channel)?.full_name || 'User';
    }
    return channel.container?.title || channel.name || 'Project Chat';
  };

  const getInitials = (name: string | null) => {
    const d = name || 'U';
    return d.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Filter channels by search
  const filterBySearch = (channel: Channel) => {
    if (!searchQuery.trim()) return true;
    const name = getChannelName(channel).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  };

  const sortedDmChannels = [...dmChannels].filter(filterBySearch).sort(sortByRecency);
  const sortedProjectChannels = [...projectChannels].filter(filterBySearch).sort(sortByRecency);

  const handleDeleteChannel = async () => {
    if (!deleteChannelTarget || !onDeleteChannel) return;
    setIsDeletingChannel(true);
    try {
      const success = await onDeleteChannel(deleteChannelTarget.id);
      if (success) {
        setDeleteChannelTarget(null);
        onChannelDeleted?.();
      }
    } finally {
      setIsDeletingChannel(false);
    }
  };

  const dmUnreadTotal = sortedDmChannels.reduce((sum, c) => sum + (unreadCounts[c.id] || 0), 0);
  const projectUnreadTotal = sortedProjectChannels.reduce((sum, c) => sum + (unreadCounts[c.id] || 0), 0);

  if (loading) {
    return (
      <div className="px-3 py-4 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted animate-pulse rounded w-24" />
              <div className="h-2 bg-muted/60 animate-pulse rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="pl-8 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {/* Direct Messages Section */}
          <div className="mb-1">
            <button
              onClick={() => setDmExpanded(!dmExpanded)}
              className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown className={cn("w-3 h-3 transition-transform", !dmExpanded && "-rotate-90")} />
                Direct Messages
                {dmUnreadTotal > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0 min-w-[16px] h-4">
                    {dmUnreadTotal}
                  </Badge>
                )}
              </span>
              {onNewDM && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNewDM(); }}
                  className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </button>

            {dmExpanded && (
              <div className="space-y-0.5">
                {sortedDmChannels.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground text-center">No direct messages</p>
                ) : (
                  sortedDmChannels.map(channel => {
                    const isSelected = channel.id === selectedChannelId;
                    const otherUser = getOtherParticipant(channel);
                    const unread = unreadCounts[channel.id] || 0;
                    const online = otherUser && isUserOnline ? isUserOnline(otherUser.id) : false;

                    return (
                      <div key={channel.id} className="group relative">
                        <button
                          onClick={() => onSelectChannel(channel.id)}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left text-sm',
                            isSelected
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'hover:bg-muted/60 text-foreground/80'
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={otherUser?.avatar_url || undefined} />
                              <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                                {getInitials(otherUser?.full_name || null)}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                                online ? "bg-green-500" : "bg-muted-foreground/40"
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">{otherUser?.full_name || 'User'}</span>
                          </div>
                          {unread > 0 && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0 min-w-[16px] h-4 flex-shrink-0">
                              {unread > 99 ? '99+' : unread}
                            </Badge>
                          )}
                        </button>
                        {/* Delete */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteChannelTarget(channel); }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Project Channels Section */}
          <div className="mt-3">
            <button
              onClick={() => setProjectExpanded(!projectExpanded)}
              className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown className={cn("w-3 h-3 transition-transform", !projectExpanded && "-rotate-90")} />
                Channels
                {projectUnreadTotal > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0 min-w-[16px] h-4">
                    {projectUnreadTotal}
                  </Badge>
                )}
              </span>
            </button>

            {projectExpanded && (
              <div className="space-y-0.5">
                {sortedProjectChannels.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground text-center">No project channels</p>
                ) : (
                  sortedProjectChannels.map(channel => {
                    const isSelected = channel.id === selectedChannelId;
                    const displayName = channel.container?.title || channel.name || 'Project';
                    const unread = unreadCounts[channel.id] || 0;

                    return (
                      <div key={channel.id} className="group relative">
                        <button
                          onClick={() => onSelectChannel(channel.id)}
                          className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left text-sm',
                            isSelected
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'hover:bg-muted/60 text-foreground/80'
                          )}
                        >
                          <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate flex-1">{displayName.toLowerCase().replace(/\s+/g, '-')}</span>
                          {unread > 0 && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0 min-w-[16px] h-4 flex-shrink-0">
                              {unread > 99 ? '99+' : unread}
                            </Badge>
                          )}
                        </button>
                        {/* Delete */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteChannelTarget(channel); }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          title="Delete channel"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Delete Chat Confirmation */}
      <AlertDialog open={!!deleteChannelTarget} onOpenChange={(open) => !open && setDeleteChannelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete this conversation?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This action <strong>cannot be undone</strong>. All messages, attachments, and reactions in this 
                conversation will be permanently deleted for all participants.
              </p>
              {deleteChannelTarget && (
                <p className="text-foreground font-medium">
                  {deleteChannelTarget.type === 'dm'
                    ? `Chat with ${getOtherParticipant(deleteChannelTarget)?.full_name || 'User'}`
                    : `# ${(deleteChannelTarget.container?.title || deleteChannelTarget.name || 'Project').toLowerCase().replace(/\s+/g, '-')}`
                  }
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingChannel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChannel}
              disabled={isDeletingChannel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingChannel ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

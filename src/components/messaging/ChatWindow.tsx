import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Send, Lock, MoreVertical, VolumeX, Volume2, FolderKanban, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useChannelMutes } from '@/hooks/useMessaging';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';

interface Sender {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender: Sender;
}

interface Participant {
  user_id: string;
  profile: Sender;
}

interface Channel {
  id: string;
  type: 'dm' | 'project';
  name: string | null;
  is_archived: boolean;
  participants: Participant[];
  project?: {
    id: string;
    title: string;
    status: string;
  } | null;
}

interface ChatWindowProps {
  channel: Channel | null;
  messages: Message[];
  loading?: boolean;
  onSendMessage: (content: string) => Promise<boolean>;
}

export function ChatWindow({ channel, messages, loading, onSendMessage }: ChatWindowProps) {
  const { user, userRole } = useAuth();
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { mutedUsers, muteUser, unmuteUser, isUserMuted } = useChannelMutes(channel?.id || null);
  const { typingUsers, onTyping, stopTyping } = useTypingIndicator(channel?.id || null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getInitials = (name: string | null, email: string) => {
    const displayName = name || email;
    return displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getOtherParticipant = () => {
    return channel?.participants.find(p => p.user_id !== user?.id)?.profile;
  };

  const handleSend = async () => {
    if (!messageInput.trim() || sending) return;

    setSending(true);
    stopTyping();
    const success = await onSendMessage(messageInput);
    if (success) {
      setMessageInput('');
    }
    setSending(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim()) {
      onTyping();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get display name for header
  const getChannelDisplayName = () => {
    if (!channel) return '';
    if (channel.type === 'dm') {
      const other = getOtherParticipant();
      return other?.full_name || other?.email || 'Unknown';
    }
    return channel.project?.title || channel.name || 'Project Chat';
  };

  // Empty state
  if (!channel) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-dark">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Select a conversation
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose a chat from the sidebar to start messaging
          </p>
        </div>
      </div>
    );
  }

  const isDM = channel.type === 'dm';
  const isArchived = channel.is_archived;
  const otherUser = isDM ? getOtherParticipant() : null;

  // Can mute: clients in project chats, or admin
  const canMute = channel.type === 'project' && (userRole === 'client' || userRole === 'admin');

  return (
    <div className="h-full flex flex-col bg-surface-dark">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDM ? (
            <Avatar className="w-10 h-10 border border-border/50">
              <AvatarImage src={otherUser?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {getInitials(otherUser?.full_name || null, otherUser?.email || '')}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">{getChannelDisplayName()}</h2>
              {isArchived && <Lock className="w-4 h-4 text-muted-foreground" />}
            </div>
            {!isDM && channel.participants.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {channel.participants.length} participants
              </p>
            )}
          </div>
        </div>

        {/* Actions for project chats */}
        {canMute && !isDM && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {channel.participants
                .filter(p => p.user_id !== user?.id)
                .map(p => (
                  <DropdownMenuItem
                    key={p.user_id}
                    onClick={() => 
                      isUserMuted(p.user_id) 
                        ? unmuteUser(p.user_id) 
                        : muteUser(p.user_id)
                    }
                  >
                    {isUserMuted(p.user_id) ? (
                      <>
                        <Volume2 className="w-4 h-4 mr-2" />
                        Unmute {p.profile.full_name || p.profile.email}
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-4 h-4 mr-2" />
                        Mute {p.profile.full_name || p.profile.email}
                      </>
                    )}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isOwn = message.sender_id === user?.id;
              const showAvatar =
                index === 0 ||
                messages[index - 1].sender_id !== message.sender_id;
              const isMuted = isUserMuted(message.sender_id);

              // For project chats, show sender as "Team" for editors (to clients)
              let displayName = message.sender.full_name || message.sender.email;
              if (!isDM && userRole === 'client' && !isOwn) {
                // Check if sender is an editor (not admin)
                // For simplicity, we'll show the actual name
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    isOwn && 'flex-row-reverse',
                    isMuted && 'opacity-50'
                  )}
                >
                  {showAvatar && !isOwn ? (
                    <Avatar className="w-8 h-8 border border-border/50 flex-shrink-0">
                      <AvatarImage src={message.sender.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {getInitials(message.sender.full_name, message.sender.email)}
                      </AvatarFallback>
                    </Avatar>
                  ) : !isOwn ? (
                    <div className="w-8 flex-shrink-0" />
                  ) : null}

                  <div
                    className={cn(
                      'max-w-[70%] rounded-2xl px-4 py-2',
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    )}
                  >
                    {showAvatar && !isOwn && (
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {displayName}
                        {isMuted && ' (muted)'}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p
                      className={cn(
                        'text-[10px] mt-1',
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {format(new Date(message.created_at), 'h:mm a')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 border-t border-border/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {typingUsers.length === 1 
                ? `${typingUsers[0].name} is typing...`
                : typingUsers.length === 2
                  ? `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`
                  : `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`
              }
            </span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        {isArchived ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
            <Lock className="w-4 h-4" />
            <span className="text-sm">This chat is archived (project completed)</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={messageInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-surface-elevated border-border/50"
              disabled={sending}
            />
            <Button
              onClick={handleSend}
              disabled={!messageInput.trim() || sending}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

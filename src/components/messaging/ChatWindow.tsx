import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Send, Lock, MoreVertical, VolumeX, Volume2, FolderKanban, MessageSquare, Trash2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useChannelMutes } from '@/hooks/useMessaging';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useChatAttachments } from '@/hooks/useChatAttachments';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { useClearChat } from '@/hooks/useClearChat';
import { ChatAttachmentButton } from './ChatAttachmentButton';
import { ChatMessageBubble } from './ChatMessageBubble';

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
  attachment_url?: string | null;
  attachment_type?: string | null;
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
  onSendMessage: (content: string, attachmentUrl?: string, attachmentType?: string) => Promise<boolean>;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ChatWindow({ channel, messages, loading, onSendMessage, onBack, showBackButton }: ChatWindowProps) {
  const { user, userRole } = useAuth();
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; type: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { mutedUsers, muteUser, unmuteUser, isUserMuted } = useChannelMutes(channel?.id || null);
  const { typingUsers, onTyping, stopTyping } = useTypingIndicator(channel?.id || null);
  const { uploadChatAttachment, uploadProgress, cancelUpload } = useChatAttachments();
  const { isMessageRead, markMessagesAsRead } = useReadReceipts(channel?.id || null);
  const { clearChat, getClearedAt } = useClearChat();

  // Filter messages based on cleared_at timestamp
  const clearedAt = channel ? getClearedAt(channel.id) : null;
  const visibleMessages = clearedAt
    ? messages.filter(m => new Date(m.created_at) > new Date(clearedAt))
    : messages;

  // Auto-scroll to bottom on new messages and channel change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [visibleMessages, channel?.id]);

  // Mark messages as read when viewing channel (for DMs)
  useEffect(() => {
    if (!channel || !user || channel.type !== 'dm' || visibleMessages.length === 0) return;

    // Get messages from other person that we need to mark as read
    const otherPersonMessages = visibleMessages
      .filter(m => m.sender_id !== user.id)
      .map(m => m.id);

    if (otherPersonMessages.length > 0) {
      markMessagesAsRead(otherPersonMessages);
    }
  }, [channel?.id, visibleMessages, user, markMessagesAsRead]);

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
    if ((!messageInput.trim() && !pendingAttachment) || sending) return;

    setSending(true);
    stopTyping();
    const success = await onSendMessage(
      messageInput,
      pendingAttachment?.url,
      pendingAttachment?.type
    );
    if (success) {
      setMessageInput('');
      setPendingAttachment(null);
    }
    setSending(false);
  };

  const handleFileSelect = async (file: File) => {
    if (!channel?.id) return;
    const result = await uploadChatAttachment(file, channel.id);
    if (result) {
      setPendingAttachment(result);
    }
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

  const handleClearChat = async () => {
    if (!channel) return;
    await clearChat(channel.id);
    setShowClearConfirm(false);
  };

  // Get display name for header
  const getChannelDisplayName = () => {
    if (!channel) return '';
    if (channel.type === 'dm') {
      const other = getOtherParticipant();
      return other?.full_name || 'User';
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
    <>
      <div className="h-full flex flex-col bg-surface-dark">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Back Button */}
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="md:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
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

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Clear Chat option */}
              <DropdownMenuItem onClick={() => setShowClearConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear chat
              </DropdownMenuItem>

              {/* Mute options for project chats */}
              {canMute && !isDM && (
                <>
                  <DropdownMenuSeparator />
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
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Loading messages...</div>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet</p>
                <p className="text-sm">Start the conversation!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleMessages.map((message, index) => {
                const isOwn = message.sender_id === user?.id;
                const showAvatar =
                  index === 0 ||
                  visibleMessages[index - 1].sender_id !== message.sender_id;
                const isMuted = isUserMuted(message.sender_id);
                
                // For DMs, check if the other person has read this message
                const otherUserId = otherUser?.id;
                const isRead = isDM && isOwn && otherUserId 
                  ? isMessageRead(message.id, otherUserId) 
                  : false;

                return (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    isOwn={isOwn}
                    showAvatar={showAvatar}
                    isMuted={isMuted}
                    isDM={isDM}
                    isDelivered={true}
                    isRead={isRead}
                  />
                );
              })}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

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
            <div className="flex gap-2 items-center">
              <ChatAttachmentButton
                onSelectFile={handleFileSelect}
                uploading={uploadProgress.uploading}
                progress={uploadProgress.progress}
                fileName={uploadProgress.fileName}
                onCancelUpload={cancelUpload}
                disabled={sending}
              />
              <Input
                value={messageInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={pendingAttachment ? "Add a caption..." : "Type a message..."}
                className="flex-1 bg-surface-elevated border-border/50"
                disabled={sending || uploadProgress.uploading}
              />
              <Button
                onClick={handleSend}
                disabled={(!messageInput.trim() && !pendingAttachment) || sending || uploadProgress.uploading}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Clear Chat Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide all messages in this chat for you. Other participants will still see the messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

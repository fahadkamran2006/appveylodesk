import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Send, Lock, MoreVertical, VolumeX, Volume2, FolderKanban, MessageSquare, Trash2, ArrowLeft, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useChannelMutes, useMessaging } from '@/hooks/useMessaging';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useChatAttachments } from '@/hooks/useChatAttachments';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { useClearChat } from '@/hooks/useClearChat';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { ChatAttachmentButton } from './ChatAttachmentButton';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatInfoDrawer } from './ChatInfoDrawer';
import { ReplyPreview } from './ReplyPreview';

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
  parent_id?: string | null;
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
  project?: { id: string; title: string; status: string } | null;
}

interface ChatWindowProps {
  channel: Channel | null;
  messages: Message[];
  loading?: boolean;
  onSendMessage: (content: string, attachmentUrl?: string, attachmentType?: string, parentId?: string | null) => Promise<boolean>;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ChatWindow({ channel, messages, loading, onSendMessage, onBack, showBackButton }: ChatWindowProps) {
  const { user, userRole } = useAuth();
  const { agencyId, refetch: refetchChannels } = useMessaging();
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; type: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { mutedUsers, muteUser, unmuteUser, isUserMuted } = useChannelMutes(channel?.id || null);
  const { typingUsers, onTyping, stopTyping } = useTypingIndicator(channel?.id || null);
  const { uploadChatAttachment, uploadProgress, cancelUpload } = useChatAttachments();
  const { isMessageRead, markMessagesAsRead } = useReadReceipts(channel?.id || null);
  const { clearChat, getClearedAt } = useClearChat();
  const { toggleReaction, getReactionSummary } = useMessageReactions(channel?.id || null);

  const clearedAt = channel ? getClearedAt(channel.id) : null;
  const visibleMessages = clearedAt
    ? messages.filter(m => new Date(m.created_at) > new Date(clearedAt))
    : messages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [visibleMessages, channel?.id]);

  useEffect(() => {
    if (!channel || !user || channel.type !== 'dm' || visibleMessages.length === 0) return;
    const otherMsgs = visibleMessages.filter(m => m.sender_id !== user.id).map(m => m.id);
    if (otherMsgs.length > 0) markMessagesAsRead(otherMsgs);
  }, [channel?.id, visibleMessages, user, markMessagesAsRead]);

  const getInitials = (name: string | null, email: string) => {
    const d = name || email;
    return d.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getOtherParticipant = () => channel?.participants.find(p => p.user_id !== user?.id)?.profile;

  const handleSend = async () => {
    if ((!messageInput.trim() && !pendingAttachment) || sending) return;
    setSending(true);
    stopTyping();

    const success = await onSendMessage(
      messageInput,
      pendingAttachment?.url,
      pendingAttachment?.type,
      replyingTo?.id || null
    );
    if (success) {
      setMessageInput('');
      setPendingAttachment(null);
      setReplyingTo(null);
    }
    setSending(false);
  };

  const handleFileSelect = async (file: File) => {
    if (!channel?.id) return;
    const result = await uploadChatAttachment(file, channel.id);
    if (result) setPendingAttachment(result);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim()) onTyping();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClearChat = async () => {
    if (!channel) return;
    await clearChat(channel.id);
    setShowClearConfirm(false);
  };

  const getChannelDisplayName = () => {
    if (!channel) return '';
    if (channel.type === 'dm') {
      const other = getOtherParticipant();
      return other?.full_name || 'User';
    }
    return channel.project?.title || channel.name || 'Project Chat';
  };

  // Build a map of messages by ID for reply lookups
  const messageMap = new Map(visibleMessages.map(m => [m.id, m]));

  if (!channel) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-dark">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-foreground mb-2">Select a conversation</h3>
          <p className="text-sm text-muted-foreground">Choose a chat from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  const isDM = channel.type === 'dm';
  const isArchived = channel.is_archived;
  const otherUser = isDM ? getOtherParticipant() : null;
  const canMute = channel.type === 'project' && (userRole === 'client' || userRole === 'admin');

  return (
    <>
      <div className="h-full flex flex-col bg-surface-dark">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
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
                <p className="text-sm text-muted-foreground">{channel.participants.length} participants</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Info Button */}
            <Button variant="ghost" size="icon" onClick={() => setShowInfoDrawer(true)}>
              <Info className="w-5 h-5" />
            </Button>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowClearConfirm(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Clear chat
                </DropdownMenuItem>
                {canMute && !isDM && (
                  <>
                    <DropdownMenuSeparator />
                    {channel.participants.filter(p => p.user_id !== user?.id).map(p => (
                      <DropdownMenuItem key={p.user_id} onClick={() => isUserMuted(p.user_id) ? unmuteUser(p.user_id) : muteUser(p.user_id)}>
                        {isUserMuted(p.user_id)
                          ? <><Volume2 className="w-4 h-4 mr-2" /> Unmute {p.profile.full_name || p.profile.email}</>
                          : <><VolumeX className="w-4 h-4 mr-2" /> Mute {p.profile.full_name || p.profile.email}</>}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                const showAvatar = index === 0 || visibleMessages[index - 1].sender_id !== message.sender_id;
                const isMuted = isUserMuted(message.sender_id);
                const otherUserId = otherUser?.id;
                const isRead = isDM && isOwn && otherUserId ? isMessageRead(message.id, otherUserId) : false;
                const parentMessage = message.parent_id ? messageMap.get(message.parent_id) || null : null;

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
                    parentMessage={parentMessage}
                    reactions={getReactionSummary(message.id)}
                    onReply={(msg) => setReplyingTo(msg)}
                    onReact={(msgId, emoji) => toggleReaction(msgId, emoji)}
                  />
                );
              })}
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
                    : `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`}
              </span>
            </div>
          </div>
        )}

        {/* Reply Preview */}
        {replyingTo && (
          <ReplyPreview
            senderName={replyingTo.sender.full_name || 'User'}
            content={replyingTo.content || '📎 Attachment'}
            onCancel={() => setReplyingTo(null)}
          />
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
                placeholder={pendingAttachment ? "Add a caption..." : replyingTo ? "Reply..." : "Type a message..."}
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
              This will hide all messages in this chat for you. Other participants will still see the messages.
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

      {/* Chat Info Drawer */}
      {channel && (
        <ChatInfoDrawer
          open={showInfoDrawer}
          onOpenChange={setShowInfoDrawer}
          channel={channel}
          agencyId={agencyId}
          onParticipantsChanged={refetchChannels}
        />
      )}
    </>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Send, Lock, MoreVertical, VolumeX, Volume2, FolderKanban, MessageSquare, Trash2, ArrowLeft, Info, ArrowDown, Smile, Image as ImageIcon, Hash } from 'lucide-react';
import { FormattingToolbar } from './FormattingToolbar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useChannelMutes, useMessaging } from '@/hooks/useMessaging';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useChatAttachments } from '@/hooks/useChatAttachments';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { useClearChat } from '@/hooks/useClearChat';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatInfoDrawer } from './ChatInfoDrawer';
import { ReplyPreview } from './ReplyPreview';
import { VoiceRecordButton } from './VoiceRecordButton';
import { EmojiPicker } from './EmojiPicker';
import { AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

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
  onEditMessage?: (messageId: string, newContent: string) => Promise<boolean>;
  onDeleteMessage?: (messageId: string) => Promise<boolean>;
  onBack?: () => void;
  showBackButton?: boolean;
}

const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

function shouldGroup(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return false;
  if (prev.sender_id !== curr.sender_id) return false;
  const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff < GROUP_THRESHOLD_MS;
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

export function ChatWindow({ channel, messages, loading, onSendMessage, onEditMessage, onDeleteMessage, onBack, showBackButton }: ChatWindowProps) {
  const { user, userRole } = useAuth();
  const { agencyId, refetch: refetchChannels } = useMessaging();
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const realIds = new Set(visibleMessages.map(m => m.id));
  const pendingOptimistic = optimisticMessages.filter(m => !realIds.has(m.id));
  const allMessages = [...visibleMessages, ...pendingOptimistic];

  useEffect(() => {
    setOptimisticMessages(prev => prev.filter(m => !realIds.has(m.id)));
  }, [messages]);

  useEffect(() => {
    setOptimisticMessages([]);
  }, [channel?.id]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
  }, []);

  useEffect(() => {
    if (isAtBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length, isAtBottom]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      setIsAtBottom(true);
    }, 50);
  }, [channel?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAtBottom(true);
  };

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
    if ((!messageInput.trim()) || sending) return;
    setSending(true);
    stopTyping();

    const content = messageInput;
    const parentId = replyingTo?.id || null;

    if (user) {
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        content,
        created_at: new Date().toISOString(),
        sender_id: user.id,
        sender: { id: user.id, full_name: user.user_metadata?.full_name || null, email: user.email || '', avatar_url: user.user_metadata?.avatar_url || null },
        attachment_url: null, attachment_type: null, parent_id: parentId,
      };
      setOptimisticMessages(prev => [...prev, optimistic]);
      setMessageInput('');
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      });
      setReplyingTo(null);
      setIsAtBottom(true);
    }

    const success = await onSendMessage(content, undefined, undefined, parentId);
    if (!success && user) {
      setOptimisticMessages(prev => prev.filter(m => !m.id.startsWith('optimistic-')));
      setMessageInput(content);
    }
    setSending(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channel?.id) return;
    e.target.value = '';

    const result = await uploadChatAttachment(file, channel.id);
    if (result) {
      await onSendMessage('', result.url, result.type);
    }
  };

  const handleVoiceSend = async (blob: Blob, durationSeconds: number) => {
    if (!channel?.id) return;
    // Upload the voice blob as a file
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
    const result = await uploadChatAttachment(file, channel.id);
    if (result) {
      await onSendMessage(`[voice:${durationSeconds}]`, result.url, 'audio');
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim()) onTyping();
    // auto-resize on next frame
    requestAnimationFrame(autoResizeTextarea);
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
    return (channel as any).container?.title || channel.name || 'Project Chat';
  };

  const messageMap = new Map(allMessages.map(m => [m.id, m]));

  if (!channel) {
    if (loading) {
      // Show skeleton when channel is loading (prevents "Your Messages" flash on mobile)
      return (
        <div className="h-full flex flex-col bg-background">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 bg-muted animate-pulse rounded" />
              <div className="h-2.5 w-16 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-3 p-4">
            {[...Array(6)].map((_, i) => {
              const isRight = i % 3 === 1;
              return (
                <div key={i} className={cn("flex gap-2", isRight ? "justify-end" : "justify-start")}>
                  {!isRight && <div className="w-7 h-7 rounded-full bg-muted animate-pulse flex-shrink-0 mt-auto" />}
                  <div className={cn("rounded-2xl animate-pulse", isRight ? "bg-primary/20" : "bg-muted", i % 2 === 0 ? "w-48 h-10" : "w-32 h-8")} />
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium text-foreground mb-1">Your Messages</h3>
          <p className="text-sm text-muted-foreground">Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  const isDM = channel.type === 'dm';
  const isArchived = channel.is_archived;
  const otherUser = isDM ? getOtherParticipant() : null;
  const canMute = channel.type === 'project' && (userRole === 'client' || userRole === 'admin');
  const hasInput = messageInput.trim().length > 0;

  // Build date-separated message groups
  const renderMessages = () => {
    const elements: React.ReactNode[] = [];
    let lastDate: string | null = null;

    allMessages.forEach((message, index) => {
      const msgDate = new Date(message.created_at);
      const dateLabel = getDateLabel(msgDate);

      if (dateLabel !== lastDate) {
        lastDate = dateLabel;
        elements.push(
          <div key={`date-${dateLabel}-${index}`} className="flex items-center justify-center my-4">
            <span className="text-[11px] text-muted-foreground/60 font-medium px-3 py-1">
              {dateLabel}
            </span>
          </div>
        );
      }

      const isOwn = message.sender_id === user?.id;
      const isOptimistic = message.id.startsWith('optimistic-');
      const grouped = shouldGroup(allMessages[index - 1], message) && !lastDate;
      const isLastInGroup = index === allMessages.length - 1 || !shouldGroup(message, allMessages[index + 1]);
      const isMuted = isUserMuted(message.sender_id);
      const otherUserId = otherUser?.id;
      const isRead = isDM && isOwn && otherUserId ? isMessageRead(message.id, otherUserId) : false;
      const parentMessage = message.parent_id ? messageMap.get(message.parent_id) || null : null;

      // Check if previous message in same date group is from same sender
      const prevInGroup = index > 0 ? allMessages[index - 1] : undefined;
      const isGroupedInDate = prevInGroup
        && prevInGroup.sender_id === message.sender_id
        && isSameDay(new Date(prevInGroup.created_at), msgDate)
        && (msgDate.getTime() - new Date(prevInGroup.created_at).getTime()) < GROUP_THRESHOLD_MS;

      elements.push(
        <ChatMessageBubble
          key={message.id}
          message={message}
          isOwn={isOwn}
          showAvatar={!isGroupedInDate}
          isMuted={isMuted}
          isDM={isDM}
          isDelivered={!isOptimistic}
          isRead={isRead}
          isOptimistic={isOptimistic}
          isGrouped={!!isGroupedInDate}
          isLastInGroup={isLastInGroup}
          parentMessage={parentMessage}
          reactions={getReactionSummary(message.id)}
          onReply={(msg) => setReplyingTo(msg)}
          onReact={(msgId, emoji) => toggleReaction(msgId, emoji)}
          onEdit={isOwn ? onEditMessage : undefined}
          onDelete={isOwn ? onDeleteMessage : undefined}
        />
      );
    });

    return elements;
  };

  return (
    <>
      <div className="h-full flex flex-col bg-background">
        {/* Header — Instagram style: clean, minimal */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden -ml-1">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            {isDM ? (
              <Avatar className="w-9 h-9">
                <AvatarImage src={otherUser?.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                  {getInitials(otherUser?.full_name || null, otherUser?.email || '')}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                <FolderKanban className="w-4.5 h-4.5 text-muted-foreground" />
              </div>
            )}
            <div>
              <h2 className="font-semibold text-foreground text-[15px] leading-tight">{getChannelDisplayName()}</h2>
              {!isDM && channel.participants.length > 0 && (
                <p className="text-xs text-muted-foreground">{channel.participants.length} members</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => setShowInfoDrawer(true)} className="text-muted-foreground hover:text-foreground">
              <Info className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
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
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto py-2 relative"
        >
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {[...Array(8)].map((_, i) => {
                const isRight = i % 3 === 1;
                return (
                  <div key={i} className={cn("flex gap-2", isRight ? "justify-end" : "justify-start")}>
                    {!isRight && <div className="w-7 h-7 rounded-full bg-muted animate-pulse flex-shrink-0 mt-auto" />}
                    <div className={cn(
                      "rounded-2xl animate-pulse",
                      isRight ? "bg-primary/20" : "bg-muted",
                      i % 2 === 0 ? "w-48 h-10" : "w-32 h-8"
                    )} />
                  </div>
                );
              })}
            </div>
          ) : allMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Start the conversation!</p>
              </div>
            </div>
          ) : (
            <div>
              <AnimatePresence initial={false}>
                {renderMessages()}
              </AnimatePresence>
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}

          {/* Scroll to bottom FAB */}
          {!isAtBottom && (
            <button
              onClick={scrollToBottom}
              className="sticky bottom-3 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted transition-all mx-auto"
            >
              <ArrowDown className="w-4 h-4 text-foreground" />
            </button>
          )}
        </div>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-5 py-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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

        {/* Upload progress overlay */}
        {uploadProgress.uploading && (
          <div className="px-4 py-2 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1">
                <p className="truncate">{uploadProgress.fileName}</p>
                <div className="w-full bg-muted rounded-full h-1 mt-1">
                  <div className="bg-primary h-1 rounded-full transition-all" style={{ width: `${uploadProgress.progress}%` }} />
                </div>
              </div>
              <button onClick={cancelUpload} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-border bg-card">
          {isArchived ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-3 px-3">
              <Lock className="w-4 h-4" />
              <span className="text-sm">This chat is archived</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Formatting toolbar — only show when not voice recording */}
              {!isVoiceRecording && (
                <div className="flex items-center gap-1 px-3 pt-2 pb-0">
                  <FormattingToolbar
                    textareaRef={textareaRef}
                    value={messageInput}
                    onChange={(val) => {
                      setMessageInput(val);
                      requestAnimationFrame(autoResizeTextarea);
                    }}
                  />
                </div>
              )}

              <div className="flex items-end gap-1 px-3 py-2">
                {!isVoiceRecording && (
                  <>
                    {/* Emoji */}
                    <EmojiPicker onSelect={(emoji) => setMessageInput(prev => prev + emoji)} />

                    {/* Textarea */}
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={messageInput}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={replyingTo ? "Reply..." : "Message..."}
                        disabled={uploadProgress.uploading}
                        rows={1}
                        className="w-full bg-transparent text-foreground text-[14px] placeholder:text-muted-foreground/50 outline-none py-2 px-1 resize-none overflow-y-auto leading-[20px]"
                        style={{ maxHeight: '150px' }}
                      />
                    </div>
                  </>
                )}

                {/* Right side actions */}
                {hasInput && !isVoiceRecording ? (
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="p-2 text-primary font-semibold text-[14px] hover:text-primary/80 transition-colors disabled:opacity-40"
                  >
                    Send
                  </button>
                ) : (
                  <div className={cn("flex items-center gap-0.5", isVoiceRecording && "flex-1")}>
                    <VoiceRecordButton
                      onSendVoice={handleVoiceSend}
                      onRecordingStateChange={setIsVoiceRecording}
                      disabled={uploadProgress.uploading}
                    />
                    {!isVoiceRecording && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadProgress.uploading}
                        className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
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

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Play, Maximize2, Check, CheckCheck, Reply, Clock, Pencil, Trash2, X, MoreHorizontal, Mic } from 'lucide-react';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import DOMPurify from 'dompurify';
import { EmojiPicker } from './EmojiPicker';
import { MessageReactions } from './MessageReactions';
import { motion } from 'framer-motion';

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

interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
  hasReacted: boolean;
}

interface ChatMessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  isMuted: boolean;
  isDM: boolean;
  isDelivered?: boolean;
  isRead?: boolean;
  isOptimistic?: boolean;
  isGrouped?: boolean;
  isLastInGroup?: boolean;
  parentMessage?: Message | null;
  reactions?: ReactionSummary[];
  onReply?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, newContent: string) => Promise<boolean>;
  onDelete?: (messageId: string) => Promise<boolean>;
}

/** Convert URLs in plain text to clickable links */
function linkifyText(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline break-all">$1</a>');
}

/** Basic markdown: **bold**, *italic*, ~~strikethrough~~, `code`, ```code blocks```, > quotes */
function parseMarkdown(text: string): string {
  let result = text.replace(/```([^`]+)```/g, '<code class="block bg-background/30 rounded px-2 py-1 text-xs font-mono my-1 whitespace-pre-wrap">$1</code>');
  result = result.replace(/`([^`]+)`/g, '<code class="bg-background/30 rounded px-1 py-0.5 text-xs font-mono">$1</code>');
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // Block quotes: lines starting with >
  result = result.replace(/^&gt;\s?(.*)$/gm, '<span class="border-l-2 border-muted-foreground/40 pl-2 text-muted-foreground italic block">$1</span>');
  result = result.replace(/^>\s?(.*)$/gm, '<span class="border-l-2 border-muted-foreground/40 pl-2 text-muted-foreground italic block">$1</span>');
  return result;
}

function renderMessageContent(content: string, isOwn: boolean) {
  const hasHtml = /<[^>]+>/.test(content);
  if (hasHtml) {
    const sanitized = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'code'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    });
    return (
      <div
        className="text-[14px] leading-[18px] whitespace-pre-wrap break-words"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }
  const processed = linkifyText(parseMarkdown(content));
  return (
    <div
    className="text-[14px] leading-[20px] whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processed, {
        ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'code', 'a', 's', 'span'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      }) }}
    />
  );
}

/** Check if content is a voice message marker */
function isVoiceMessage(content: string): boolean {
  return content.startsWith('[voice:') && content.endsWith(']');
}

function getVoiceDuration(content: string): number {
  const match = content.match(/\[voice:(\d+)\]/);
  return match ? parseInt(match[1], 10) : 0;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ChatMessageBubble({
  message, isOwn, showAvatar, isMuted, isDM,
  isDelivered = true, isRead = false,
  isOptimistic = false, isGrouped = false, isLastInGroup = true,
  parentMessage, reactions = [], onReply, onReact, onEdit, onDelete,
}: ChatMessageBubbleProps) {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  

  const getInitials = (name: string | null, email: string) => {
    const d = name || email || 'U';
    return d.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const displayName = message.sender.full_name || 'User';
  const hasAttachment = message.attachment_url && message.attachment_type;
  const isImage = message.attachment_type === 'image';
  const isVideo = message.attachment_type === 'video';
  const isAudio = message.attachment_type === 'audio';
  const isVoice = isVoiceMessage(message.content);

  const handleVideoToggle = (video: HTMLVideoElement) => {
    if (video.paused) { video.play(); setVideoPlaying(true); }
    else { video.pause(); setVideoPlaying(false); }
  };

  const handleEdit = async () => {
    if (!editContent.trim() || editContent.trim() === message.content) {
      setIsEditing(false);
      setEditContent(message.content);
      return;
    }
    const success = await onEdit?.(message.id, editContent.trim());
    if (success) setIsEditing(false);
  };

  const handleDelete = async () => {
    await onDelete?.(message.id);
    setShowDeleteConfirm(false);
  };

  // Instagram-style: actions appear inline next to the bubble on hover
  const actionButtons = showActions && !isMuted && !isOptimistic && !isEditing && (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
      {onReact && (
        <EmojiPicker onSelect={(emoji) => onReact(message.id, emoji)} />
      )}
      {onReply && (
        <button
          onClick={() => onReply(message)}
          className="p-1.5 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Reply className="w-4 h-4" />
        </button>
      )}
      {isOwn && (onEdit || onDelete) && (
        <div className="relative group/more">
          <button className="p-1.5 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <div className="absolute hidden group-hover/more:flex flex-col z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px]"
            style={{ right: 0, top: '100%' }}>
            {onEdit && message.content && !isVoice && (
              <button
                onClick={() => { setIsEditing(true); setEditContent(message.content); }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted/60 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: isOptimistic ? 0.6 : 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className={cn(
      'group flex items-end gap-1.5 relative px-4',
          isOwn ? 'flex-row-reverse' : 'flex-row',
          isMuted && 'opacity-50',
          isGrouped ? 'mt-[2px]' : 'mt-3',
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onTouchStart={() => setShowActions(true)}
      >
        {/* Avatar or spacer — only for others */}
        {!isOwn && (
          isLastInGroup && showAvatar ? (
            <Avatar className="w-7 h-7 flex-shrink-0 mt-auto">
              <AvatarImage src={message.sender.avatar_url || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                {getInitials(message.sender.full_name, message.sender.email)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-7 flex-shrink-0" />
          )
        )}



        <div className={cn('max-w-[65%] min-w-[60px]', isOwn && 'items-end')}>
          {/* Sender name for groups */}
          {showAvatar && !isOwn && !isDM && (
            <p className="text-[11px] font-medium text-muted-foreground mb-0.5 ml-1">
              {displayName}
            </p>
          )}

          <div className={cn(
            'rounded-2xl overflow-hidden',
            isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground',
            // Instagram-style rounded corners
            isOwn && isGrouped && !isLastInGroup && 'rounded-br-md rounded-tr-md',
            isOwn && isLastInGroup && isGrouped && 'rounded-br-md',
            isOwn && !isGrouped && isLastInGroup && 'rounded-br-md',
            !isOwn && isGrouped && !isLastInGroup && 'rounded-bl-md rounded-tl-md',
            !isOwn && isLastInGroup && isGrouped && 'rounded-bl-md',
            !isOwn && !isGrouped && isLastInGroup && 'rounded-bl-md',
          )}>
            {/* Reply Preview — Instagram style */}
            {parentMessage && (
              <div className={cn(
                'mx-2 mt-2 px-3 py-1.5 rounded-lg text-[12px]',
                isOwn
                  ? 'bg-primary-foreground/10'
                  : 'bg-muted/60'
              )}>
                <p className={cn('font-medium', isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {parentMessage.sender.full_name || 'User'}
                </p>
                <p className={cn('truncate', isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground/80')}>
                  {parentMessage.content || '📎 Attachment'}
                </p>
              </div>
            )}

            {/* Attachment */}
            {hasAttachment && (
              <div className={cn(message.content && !isVoice ? 'p-1 pb-0' : 'p-1')}>
                {isImage && (
                  <div className="relative cursor-pointer group/img" onClick={() => setLightboxOpen(true)}>
                    <img src={message.attachment_url!} alt="Attachment" className="max-w-full max-h-[280px] rounded-xl object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors rounded-xl flex items-center justify-center">
                      <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                    </div>
                  </div>
                )}
                {isVideo && (
                  <div className="relative rounded-xl overflow-hidden">
                    <video
                      src={message.attachment_url!} className="max-w-full max-h-[280px] rounded-xl"
                      playsInline onEnded={() => setVideoPlaying(false)}
                      onClick={(e) => handleVideoToggle(e.currentTarget)}
                    />
                    {!videoPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                        onClick={(e) => { handleVideoToggle((e.currentTarget.previousSibling as HTMLVideoElement)); }}>
                        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="w-5 h-5 text-primary ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {isAudio && !isVoice && (
                  <div className="px-3 py-2">
                    <audio src={message.attachment_url!} controls className="max-w-full h-8" />
                  </div>
                )}
              </div>
            )}

            {/* Voice message — polished player */}
            {isVoice && hasAttachment && (
              <VoiceNotePlayer
                messageId={message.id}
                attachmentUrl={message.attachment_url!}
                durationSeconds={getVoiceDuration(message.content)}
                isOwn={isOwn}
              />
            )}

            {/* Text or Edit mode */}
            {isEditing ? (
              <div className="px-2 py-2">
                <Input
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEdit();
                    if (e.key === 'Escape') { setIsEditing(false); setEditContent(message.content); }
                  }}
                  className="text-sm bg-background/20 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50"
                  autoFocus
                />
                <div className="flex items-center gap-1 mt-1">
                  <button onClick={handleEdit} className="p-1 rounded hover:bg-primary-foreground/20 text-primary-foreground/80">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setIsEditing(false); setEditContent(message.content); }} className="p-1 rounded hover:bg-primary-foreground/20 text-primary-foreground/80">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-primary-foreground/50 ml-1">Enter · Esc</span>
                </div>
              </div>
            ) : message.content && !isVoice ? (
              <div className="px-3 py-[6px]">
                {renderMessageContent(message.content, isOwn)}
              </div>
            ) : null}

            {/* Timestamp & Read Status — inside bubble */}
            <div className={cn(
              'px-3 pb-1 flex items-center gap-1',
              isOwn ? 'justify-end' : 'justify-end',
              !message.content && hasAttachment && 'pt-0.5'
            )}>
              <p className={cn('text-[10px]', isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground/60')}>
                {format(new Date(message.created_at), 'h:mm a')}
              </p>
              {isOwn && isDM && (
                <span className={cn('flex items-center', isRead ? 'text-blue-400' : isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground')}>
                  {isOptimistic ? (
                    <Clock className="w-3 h-3" />
                  ) : isRead ? (
                    <CheckCheck className="w-3 h-3" />
                  ) : isDelivered ? (
                    <Check className="w-3 h-3" />
                  ) : null}
                </span>
              )}
            </div>
          </div>

          {/* Reactions */}
          <MessageReactions
            reactions={reactions}
            onToggle={(emoji) => onReact?.(message.id, emoji)}
            isOwn={isOwn}
          />
        </div>

        {/* Actions: left of own (via flex-row-reverse), right of others */}
        {actionButtons}
      </motion.div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className={cn('flex gap-2 items-center px-4 py-2', isOwn ? 'justify-end' : 'justify-start')}>
          <span className="text-xs text-muted-foreground">Delete this message?</span>
          <button
            onClick={handleDelete}
            className="text-xs px-2.5 py-1 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Image Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-0">
          <img src={message.attachment_url!} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}

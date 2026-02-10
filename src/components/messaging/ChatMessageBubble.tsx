import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Play, Maximize2, Check, CheckCheck, Reply, Clock } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
}

/** Convert URLs in plain text to clickable links */
function linkifyText(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline break-all">$1</a>');
}

/** Basic markdown: **bold**, *italic*, `code`, ```code blocks``` */
function parseMarkdown(text: string): string {
  // Code blocks first
  let result = text.replace(/```([^`]+)```/g, '<code class="block bg-background/30 rounded px-2 py-1 text-xs font-mono my-1 whitespace-pre-wrap">$1</code>');
  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code class="bg-background/30 rounded px-1 py-0.5 text-xs font-mono">$1</code>');
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return result;
}

function renderMessageContent(content: string) {
  const hasHtml = /<[^>]+>/.test(content);
  if (hasHtml) {
    const sanitized = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'code'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    });
    return (
      <div
        className="text-sm whitespace-pre-wrap break-words prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }
  // Plain text: apply markdown then linkify
  const processed = linkifyText(parseMarkdown(content));
  return (
    <div
      className="text-sm whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processed, {
        ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'code', 'a'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      }) }}
    />
  );
}

export function ChatMessageBubble({
  message, isOwn, showAvatar, isMuted, isDM,
  isDelivered = true, isRead = false,
  isOptimistic = false, isGrouped = false, isLastInGroup = true,
  parentMessage, reactions = [], onReply, onReact,
}: ChatMessageBubbleProps) {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const getInitials = (name: string | null, email: string) => {
    const d = name || email || 'U';
    return d.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const displayName = message.sender.full_name || 'User';
  const hasAttachment = message.attachment_url && message.attachment_type;
  const isImage = message.attachment_type === 'image';
  const isVideo = message.attachment_type === 'video';

  const handleVideoToggle = (video: HTMLVideoElement) => {
    if (video.paused) { video.play(); setVideoPlaying(true); }
    else { video.pause(); setVideoPlaying(false); }
  };

  return (
    <>
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: isOptimistic ? 0.5 : 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'group flex gap-3 relative',
          isOwn && 'flex-row-reverse',
          isMuted && 'opacity-50',
          isGrouped ? 'mt-0.5' : 'mt-3',
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onTouchStart={() => setShowActions(true)}
      >
        {/* Avatar or spacer */}
        {showAvatar && !isOwn ? (
          <Avatar className="w-8 h-8 border border-border/50 flex-shrink-0 mt-1">
            <AvatarImage src={message.sender.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {getInitials(message.sender.full_name, message.sender.email)}
            </AvatarFallback>
          </Avatar>
        ) : !isOwn ? (
          <div className="w-8 flex-shrink-0" />
        ) : null}

        <div className="max-w-[70%]">
          {/* Hover Actions */}
          {showActions && !isMuted && !isOptimistic && (
            <div className={cn(
              'flex items-center gap-0.5 mb-0.5',
              isOwn ? 'justify-end' : 'justify-start'
            )}>
              {onReply && (
                <button
                  onClick={() => onReply(message)}
                  className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
              )}
              {onReact && (
                <EmojiPicker onSelect={(emoji) => onReact(message.id, emoji)} />
              )}
            </div>
          )}

          <div className={cn(
            'rounded-2xl overflow-hidden',
            isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground',
            // Tighter radius on grouped edges
            isOwn
              ? (isGrouped ? 'rounded-tr-md' : '') + (isLastInGroup ? ' rounded-br-md' : '')
              : (isGrouped ? 'rounded-tl-md' : '') + (isLastInGroup ? ' rounded-bl-md' : ''),
          )}>
            {/* Sender name - only on first message in group */}
            {showAvatar && !isOwn && (
              <div className="px-4 pt-2">
                <p className="text-xs font-medium opacity-70">
                  {displayName}
                  {isMuted && ' (muted)'}
                </p>
              </div>
            )}

            {/* Reply Preview */}
            {parentMessage && (
              <div className={cn(
                'mx-2 mt-2 px-3 py-1.5 rounded-lg border-l-2',
                isOwn
                  ? 'bg-primary-foreground/10 border-primary-foreground/40'
                  : 'bg-background/50 border-primary/50'
              )}>
                <p className={cn('text-[11px] font-medium', isOwn ? 'text-primary-foreground/80' : 'text-primary')}>
                  {parentMessage.sender.full_name || 'User'}
                </p>
                <p className={cn('text-[11px] truncate', isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                  {parentMessage.content || '📎 Attachment'}
                </p>
              </div>
            )}

            {/* Attachment */}
            {hasAttachment && (
              <div className="p-1">
                {isImage && (
                  <div className="relative group/img cursor-pointer" onClick={() => setLightboxOpen(true)}>
                    <img src={message.attachment_url!} alt="Attachment" className="max-w-full max-h-[300px] rounded-lg object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                      <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                    </div>
                  </div>
                )}
                {isVideo && (
                  <div className="relative rounded-lg overflow-hidden">
                    <video
                      src={message.attachment_url!} className="max-w-full max-h-[300px] rounded-lg"
                      playsInline onEnded={() => setVideoPlaying(false)}
                      onClick={(e) => handleVideoToggle(e.currentTarget)}
                    />
                    {!videoPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                        onClick={(e) => { handleVideoToggle((e.currentTarget.previousSibling as HTMLVideoElement)); }}>
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="w-6 h-6 text-primary ml-1" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Text */}
            {message.content && (
              <div className="px-4 py-2">
                {renderMessageContent(message.content)}
              </div>
            )}

            {/* Timestamp & Read Status */}
            <div className={cn('px-4 pb-1.5 flex items-center justify-end gap-1', !message.content && hasAttachment && 'pt-1')}>
              <p className={cn('text-[10px]', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {format(new Date(message.created_at), 'h:mm a')}
              </p>
              {isOwn && isDM && (
                <span className={cn('flex items-center', isRead ? 'text-blue-400' : isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                  {isOptimistic ? (
                    <Clock className="w-3 h-3" />
                  ) : isRead ? (
                    <CheckCheck className="w-3.5 h-3.5" />
                  ) : isDelivered ? (
                    <Check className="w-3.5 h-3.5" />
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
      </motion.div>

      {/* Image Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-0">
          <img src={message.attachment_url!} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Play, Maximize2, Check, CheckCheck, Reply, SmilePlus } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import DOMPurify from 'dompurify';
import { EmojiPicker } from './EmojiPicker';
import { MessageReactions } from './MessageReactions';

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
  parentMessage?: Message | null;
  reactions?: ReactionSummary[];
  onReply?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

function renderMessageContent(content: string) {
  const hasHtml = /<[^>]+>/.test(content);
  if (hasHtml) {
    const sanitized = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    return (
      <div
        className="text-sm whitespace-pre-wrap break-words prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }
  return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
}

export function ChatMessageBubble({
  message, isOwn, showAvatar, isMuted, isDM,
  isDelivered = true, isRead = false,
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
      <div
        className={cn('group flex gap-3 relative', isOwn && 'flex-row-reverse', isMuted && 'opacity-50')}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onTouchStart={() => setShowActions(true)}
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

        <div className="max-w-[70%]">
          {/* Hover Actions */}
          {showActions && !isMuted && (
            <div className={cn(
              'flex items-center gap-0.5 mb-1',
              isOwn ? 'justify-end' : 'justify-start'
            )}>
              {onReply && (
                <button
                  onClick={() => onReply(message)}
                  className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Reply className="w-4 h-4" />
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
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md'
          )}>
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
            <div className={cn('px-4 pb-2 flex items-center justify-end gap-1', !message.content && hasAttachment && 'pt-1')}>
              <p className={cn('text-[10px]', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {format(new Date(message.created_at), 'h:mm a')}
              </p>
              {isOwn && isDM && (
                <span className={cn('flex items-center', isRead ? 'text-blue-400' : isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                  {isRead ? <CheckCheck className="w-3.5 h-3.5" /> : isDelivered ? <Check className="w-3.5 h-3.5" /> : null}
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
      </div>

      {/* Image Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-0">
          <img src={message.attachment_url!} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}

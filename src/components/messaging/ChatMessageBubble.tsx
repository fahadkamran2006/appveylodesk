import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Play, Pause, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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

interface ChatMessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  isMuted: boolean;
  isDM: boolean;
}

export function ChatMessageBubble({
  message,
  isOwn,
  showAvatar,
  isMuted,
  isDM,
}: ChatMessageBubbleProps) {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const getInitials = (name: string | null, email: string) => {
    const displayName = name || email;
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = message.sender.full_name || message.sender.email;

  const handleVideoToggle = (video: HTMLVideoElement) => {
    if (video.paused) {
      video.play();
      setVideoPlaying(true);
    } else {
      video.pause();
      setVideoPlaying(false);
    }
  };

  const hasAttachment = message.attachment_url && message.attachment_type;
  const isImage = message.attachment_type === 'image';
  const isVideo = message.attachment_type === 'video';

  return (
    <>
      <div
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
            'max-w-[70%] rounded-2xl overflow-hidden',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md'
          )}
        >
          {showAvatar && !isOwn && (
            <div className="px-4 pt-2">
              <p className="text-xs font-medium opacity-70">
                {displayName}
                {isMuted && ' (muted)'}
              </p>
            </div>
          )}

          {/* Attachment Preview */}
          {hasAttachment && (
            <div className="p-1">
              {isImage && (
                <div className="relative group cursor-pointer" onClick={() => setLightboxOpen(true)}>
                  <img
                    src={message.attachment_url!}
                    alt="Attachment"
                    className="max-w-full max-h-[300px] rounded-lg object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}

              {isVideo && (
                <div className="relative group rounded-lg overflow-hidden">
                  <video
                    src={message.attachment_url!}
                    className="max-w-full max-h-[300px] rounded-lg"
                    playsInline
                    muted={false}
                    onEnded={() => setVideoPlaying(false)}
                    onClick={(e) => handleVideoToggle(e.currentTarget)}
                  />
                  {!videoPlaying && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                      onClick={(e) => {
                        const video = (e.currentTarget.previousSibling as HTMLVideoElement);
                        handleVideoToggle(video);
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-6 h-6 text-primary ml-1" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Text Content */}
          {message.content && (
            <div className="px-4 py-2">
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          )}

          {/* Timestamp */}
          <div className={cn(
            'px-4 pb-2',
            !message.content && hasAttachment && 'pt-1'
          )}>
            <p
              className={cn(
                'text-[10px]',
                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            >
              {format(new Date(message.created_at), 'h:mm a')}
            </p>
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-0">
          <img
            src={message.attachment_url!}
            alt="Full size attachment"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

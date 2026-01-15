import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle } from 'lucide-react';
import { VideoComment } from '@/hooks/useVideoComments';
import {
  extractDeliverablesPathFromUrl,
  getDeliverableSignedUrl,
  guessVideoMimeType,
} from '@/lib/deliverables';

interface VideoPlayerProps {
  /** Original src (typically deliverable.file_url) */
  src: string;
  /** When provided, we fetch a signed URL via backend (bypasses storage/RLS issues) */
  deliverableId?: string;
  comments: VideoComment[];
  onTimeUpdate?: (time: number) => void;
  onSeekToComment?: (timestamp: number) => void;
  onAddComment?: (timestamp: number) => void;
  showCommentMarkers?: boolean;
  className?: string;
}

export function VideoPlayer({
  src,
  deliverableId,
  comments,
  onTimeUpdate,
  onSeekToComment,
  onAddComment,
  showCommentMarkers = true,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve playback URL (prefer backend-signed URL when deliverableId is available)
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      setError(null);
      setPlaybackUrl(null);

      try {
        if (deliverableId) {
          const signed = await getDeliverableSignedUrl(deliverableId);
          if (!signed) throw new Error('Could not create a signed URL');
          if (!cancelled) setPlaybackUrl(signed);
          return;
        }

        // Fallback: attempt to sign based on URL pattern
        const filePath = extractDeliverablesPathFromUrl(src);
        if (filePath) {
          const { data, error } = await supabase.storage
            .from('deliverables')
            .createSignedUrl(filePath, 3600);

          if (error) throw error;
          if (!cancelled) setPlaybackUrl(data.signedUrl);
          return;
        }

        if (!cancelled) setPlaybackUrl(src);
      } catch (e: any) {
        console.error('Video resolve error:', e);
        if (!cancelled) {
          setError(e?.message || 'Video could not be loaded.');
        }
      }
    };

    if (src) resolve();

    return () => {
      cancelled = true;
    };
  }, [src, deliverableId]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    onTimeUpdate?.(videoRef.current.currentTime);
  };

  if (error) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center bg-muted rounded-lg', className)}>
        <div className="text-center p-6">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
          <p className="text-sm font-medium text-foreground">Video Playback Error</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!playbackUrl) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center bg-muted rounded-lg', className)}>
        <div className="text-xs text-muted-foreground">Loading video…</div>
      </div>
    );
  }

  const mimeType = guessVideoMimeType(src);

  return (
    <div className={cn('w-full h-full', className)}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain rounded-lg"
        controls
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onError={() => {
          setError('Failed to play this video. Please try downloading it.');
        }}
      >
        {/* Using <source> helps MOV playback on Safari/iOS */}
        <source src={playbackUrl} type={mimeType} />
        Your browser does not support video playback.
      </video>
    </div>
  );
}


import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle } from 'lucide-react';
import { VideoComment } from '@/hooks/useVideoComments';

function isBunnyCdnUrl(url: string): boolean {
  return url.includes('b-cdn.net') || url.includes('bunnycdn');
}

function extractDeliverablesPathFromUrl(fileUrl: string): string | null {
  if (!fileUrl) return null;

  // If we already have a storage path like "projectId/filename.ext"
  if (!/^https?:\/\//i.test(fileUrl)) {
    return decodeURIComponent(fileUrl.split('?')[0]);
  }

  const idx = fileUrl.indexOf('/deliverables/');
  if (idx === -1) return null;

  const path = fileUrl.slice(idx + '/deliverables/'.length);
  return decodeURIComponent(path.split('?')[0]);
}

function guessVideoMimeType(fileNameOrUrl: string): string | undefined {
  const clean = fileNameOrUrl.split('?')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;

  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mkv') return 'video/x-matroska';
  if (ext === 'avi') return 'video/x-msvideo';
  return undefined;
}

async function getDeliverableSignedUrl(
  deliverableId: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('deliverables-ops', {
    body: { action: 'signed_url', deliverableId, expiresIn },
  });

  if (error) throw error;
  if (!data) return null;
  if ((data as any).error) throw new Error((data as any).error);

  return (data as any).signedUrl ?? null;
}

interface VideoPlayerProps {
  /** Original src (typically deliverable.file_url) - can be Bunny CDN or Supabase URL */
  src: string;
  /** When provided and NOT a Bunny CDN URL, we fetch a signed URL via backend */
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
  // Suppress unused variable warnings – props kept for API compatibility
  void comments;
  void onSeekToComment;
  void onAddComment;
  void showCommentMarkers;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve playback URL
  // For Bunny CDN URLs: use directly (fast CDN, no signing needed)
  // For Supabase URLs: use signed URL via backend
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      setError(null);
      setPlaybackUrl(null);

      try {
        // Bunny CDN URLs can be used directly - they're fast and don't need signing
        if (isBunnyCdnUrl(src)) {
          console.log('Using Bunny CDN URL directly:', src);
          if (!cancelled) setPlaybackUrl(src);
          return;
        }

        // For Supabase storage, get signed URL
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

        // Use URL as-is
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

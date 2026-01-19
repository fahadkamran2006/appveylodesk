import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { VideoComment } from '@/hooks/useVideoComments';

function isBunnyCdnUrl(url: string): boolean {
  return url.includes('b-cdn.net') || url.includes('bunnycdn');
}

function isBunnyStreamHlsUrl(url: string): boolean {
  return url.includes('.b-cdn.net/') && url.includes('/playlist.m3u8');
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
  if (ext === 'm3u8') return 'application/vnd.apple.mpegurl';
  return undefined;
}

async function getDeliverableSignedUrl(
  deliverableId: string,
  fileUrl: string,
  expiresIn = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('deliverables-ops', {
      body: { action: 'signed_url', deliverableId, expiresIn },
    });

    if (error) throw error;
    if (!data) throw new Error('No response from edge function');
    if ((data as any).error) throw new Error((data as any).error);

    return (data as any).signedUrl ?? null;
  } catch (edgeFnError) {
    console.warn('Edge function failed, attempting frontend fallback:', edgeFnError);
    
    // Fallback: try to create signed URL directly via Supabase client
    const filePath = extractDeliverablesPathFromUrl(fileUrl);
    if (filePath) {
      const { data, error } = await supabase.storage
        .from('deliverables')
        .createSignedUrl(filePath, expiresIn);
      
      if (!error && data?.signedUrl) {
        console.log('Fallback signed URL created successfully');
        return data.signedUrl;
      }
    }
    
    // Re-throw original error if fallback also fails
    throw edgeFnError;
  }
}

interface StreamStatus {
  isReady: boolean;
  status: number;
  hlsUrl?: string;
  mp4Url?: string | null;
}

async function checkStreamStatus(fileUrl: string): Promise<StreamStatus | null> {
  try {
    const { data, error } = await supabase.functions.invoke('bunny-ops', {
      body: { action: 'stream_status', fileUrl },
    });
    
    if (error || !data?.ok) return null;
    return data as StreamStatus;
  } catch {
    return null;
  }
}

interface VideoPlayerProps {
  /** Original src (typically deliverable.file_url) - can be Bunny CDN, Bunny Stream HLS, or Supabase URL */
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
  const hlsRef = useRef<Hls | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isHls, setIsHls] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup HLS instance
  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Initialize HLS.js for adaptive streaming
  const initializeHls = useCallback((url: string, video: HTMLVideoElement) => {
    cleanupHls();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // Optimize for VOD playback
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest loaded, quality levels:', hls.levels.length);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('Fatal HLS error:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover network error
              console.log('Attempting to recover from network error...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Attempting to recover from media error...');
              hls.recoverMediaError();
              break;
            default:
              setError('Video playback error. The video may still be processing.');
              cleanupHls();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = url;
    } else {
      setError('Your browser does not support HLS video playback.');
    }
  }, [cleanupHls]);

  // Resolve playback URL
  useEffect(() => {
    let cancelled = false;
    let pollInterval: NodeJS.Timeout | null = null;

    const resolve = async () => {
      setError(null);
      setPlaybackUrl(null);
      setIsHls(false);
      setIsProcessing(false);

      try {
        // Check if it's a Bunny Stream HLS URL
        if (isBunnyStreamHlsUrl(src)) {
          console.log('Detected Bunny Stream HLS URL:', src);
          
          // Check if video is ready
          const status = await checkStreamStatus(src);
          
          if (status && !status.isReady) {
            console.log('Video is still processing, status:', status.status);
            setIsProcessing(true);
            
            // Poll for status updates
            pollInterval = setInterval(async () => {
              const newStatus = await checkStreamStatus(src);
              if (newStatus?.isReady) {
                if (pollInterval) clearInterval(pollInterval);
                if (!cancelled) {
                  setIsProcessing(false);
                  setPlaybackUrl(src);
                  setIsHls(true);
                }
              }
            }, 5000);
            
            return;
          }
          
          if (!cancelled) {
            setPlaybackUrl(src);
            setIsHls(true);
          }
          return;
        }

        // Regular Bunny CDN URLs can be used directly
        if (isBunnyCdnUrl(src)) {
          console.log('Using Bunny CDN URL directly:', src);
          if (!cancelled) {
            setPlaybackUrl(src);
            setIsHls(false);
          }
          return;
        }

        // For Supabase storage, get signed URL
        if (deliverableId) {
          const signed = await getDeliverableSignedUrl(deliverableId, src);
          if (!signed) throw new Error('Could not create a signed URL');
          if (!cancelled) {
            setPlaybackUrl(signed);
            setIsHls(false);
          }
          return;
        }

        // Fallback: attempt to sign based on URL pattern
        const filePath = extractDeliverablesPathFromUrl(src);
        if (filePath) {
          const { data, error } = await supabase.storage
            .from('deliverables')
            .createSignedUrl(filePath, 3600);

          if (error) throw error;
          if (!cancelled) {
            setPlaybackUrl(data.signedUrl);
            setIsHls(false);
          }
          return;
        }

        // Use URL as-is
        if (!cancelled) {
          setPlaybackUrl(src);
          setIsHls(src.endsWith('.m3u8'));
        }
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
      if (pollInterval) clearInterval(pollInterval);
      cleanupHls();
    };
  }, [src, deliverableId, cleanupHls]);

  // Setup HLS or native playback when URL is ready
  useEffect(() => {
    if (!playbackUrl || !videoRef.current) return;

    if (isHls) {
      initializeHls(playbackUrl, videoRef.current);
    } else {
      // For non-HLS, set src directly
      videoRef.current.src = playbackUrl;
    }
  }, [playbackUrl, isHls, initializeHls]);

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

  if (isProcessing) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center bg-muted rounded-lg', className)}>
        <div className="text-center p-6">
          <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">Processing Video</p>
          <p className="text-xs text-muted-foreground mt-1">
            This video is being transcoded for optimal playback. This may take a few minutes.
          </p>
        </div>
      </div>
    );
  }

  if (!playbackUrl) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center bg-muted rounded-lg', className)}>
        <div className="text-center">
          <Loader2 className="w-6 h-6 mx-auto mb-2 text-muted-foreground animate-spin" />
          <div className="text-xs text-muted-foreground">Loading video…</div>
        </div>
      </div>
    );
  }

  const mimeType = isHls ? 'application/vnd.apple.mpegurl' : guessVideoMimeType(src);

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
          if (!isHls) {
            setError('Failed to play this video. Please try downloading it.');
          }
        }}
      >
        {!isHls && <source src={playbackUrl} type={mimeType} />}
        Your browser does not support video playback.
      </video>
    </div>
  );
}

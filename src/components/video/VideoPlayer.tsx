import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { VideoComment } from '@/hooks/useVideoComments';

// Bunny Stream Library ID
const BUNNY_STREAM_LIBRARY_ID = '582147';

// Check if URL/ID is a Bunny Stream video (GUID format)
function isBunnyStreamVideo(urlOrId: string): boolean {
  if (!urlOrId) return false;
  
  // Bunny Stream video IDs are GUIDs like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // Check if it's a direct GUID (most common case for Stream videos)
  if (guidPattern.test(urlOrId)) {
    return true;
  }
  
  // Check if the URL contains a Bunny Stream HLS pattern
  if (urlOrId.includes('.b-cdn.net/') && urlOrId.includes('/playlist.m3u8')) {
    return true;
  }
  
  // Check if URL contains a GUID pattern (e.g., in the path)
  const guidMatch = urlOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (guidMatch) {
    return true;
  }
  
  return false;
}

// Extract video ID from Bunny Stream URL or GUID
function extractBunnyStreamVideoId(url: string): string | null {
  if (!url) return null;
  
  // Pattern: direct GUID (most common for Stream videos stored in DB)
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (guidPattern.test(url)) return url;
  
  // Pattern: https://xxx.b-cdn.net/{videoId}/playlist.m3u8
  const hlsMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8/i);
  if (hlsMatch) return hlsMatch[1];
  
  // Pattern: GUID anywhere in URL
  const guidMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (guidMatch) return guidMatch[1];
  
  return null;
}

// Generate Bunny Stream embed URL - ALWAYS use this for Stream videos
function getBunnyStreamEmbedUrl(videoId: string): string {
  return `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}?autoplay=false&preload=true`;
}

// Generate Bunny Stream MP4 download URL
export function getBunnyStreamDownloadUrl(videoId: string): string {
  return `https://video.bunnycdn.com/play/${BUNNY_STREAM_LIBRARY_ID}/${videoId}/mp4_source`;
}

// Check if URL is a regular file (not a Stream video)
function isRegularVideoFile(url: string): boolean {
  if (!url) return false;
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  return ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext || '');
}

function extractDeliverablesPathFromUrl(fileUrl: string): string | null {
  if (!fileUrl) return null;

  // If we already have a storage path like "projectId/filename.ext"
  if (!/^https?:\/\//i.test(fileUrl)) {
    // Don't treat GUIDs as storage paths
    if (isBunnyStreamVideo(fileUrl)) return null;
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

export interface VideoPlayerHandle {
  pause: () => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  /** Original src (typically deliverable.file_url) - can be Bunny Stream GUID, HLS URL, or Supabase URL */
  src: string;
  /** When provided and NOT a Bunny Stream video, we fetch a signed URL via backend */
  deliverableId?: string;
  comments: VideoComment[];
  onTimeUpdate?: (time: number) => void;
  onSeekToComment?: (timestamp: number) => void;
  onAddComment?: (timestamp: number) => void;
  onPause?: () => void;
  onPlay?: () => void;
  showCommentMarkers?: boolean;
  className?: string;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({
  src,
  deliverableId,
  comments,
  onTimeUpdate,
  onSeekToComment,
  onAddComment,
  onPause,
  onPlay,
  showCommentMarkers = true,
  className,
}, ref) => {
  // Suppress unused variable warnings – props kept for API compatibility
  void comments;
  void onSeekToComment;
  void onAddComment;
  void showCommentMarkers;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isHls, setIsHls] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useIframeEmbed, setUseIframeEmbed] = useState(false);
  const [streamVideoId, setStreamVideoId] = useState<string | null>(null);
  const [iframePaused, setIframePaused] = useState(false);
  const [iframeTime, setIframeTime] = useState(0);

  // Expose pause and getCurrentTime methods for parent components
  useImperativeHandle(ref, () => ({
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause();
      } else if (iframeRef.current && streamVideoId) {
        // Send pause message to Bunny iframe
        iframeRef.current.contentWindow?.postMessage({ event: 'pause' }, '*');
        setIframePaused(true);
        onPause?.();
      }
    },
    getCurrentTime: () => {
      if (videoRef.current) {
        return videoRef.current.currentTime;
      }
      return iframeTime;
    }
  }));

  // Listen for messages from Bunny Stream iframe
  useEffect(() => {
    if (!useIframeEmbed) return;

    const handleMessage = (event: MessageEvent) => {
      // Bunny Stream sends progress events
      if (event.data?.event === 'timeupdate' && typeof event.data?.currentTime === 'number') {
        const time = event.data.currentTime;
        setIframeTime(time);
        onTimeUpdate?.(time);
      }
      if (event.data?.event === 'pause') {
        setIframePaused(true);
        onPause?.();
      }
      if (event.data?.event === 'play') {
        setIframePaused(false);
        onPlay?.();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [useIframeEmbed, onTimeUpdate, onPause, onPlay]);

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
      setUseIframeEmbed(false);
      setStreamVideoId(null);

      try {
        // PRIORITY: Check if it's a Bunny Stream video (GUID or Stream URL)
        // This MUST be checked first to avoid using wrong CDN URLs
        if (isBunnyStreamVideo(src)) {
          const videoId = extractBunnyStreamVideoId(src);
          console.log('Detected Bunny Stream video, using iframe embed. ID:', videoId);
          
          if (videoId) {
            // Check if video is ready
            const status = await checkStreamStatus(src);
            
            if (status && !status.isReady && status.status < 4) {
              console.log('Video is still processing, status:', status.status);
              setIsProcessing(true);
              
              // Poll for status updates
              pollInterval = setInterval(async () => {
                const newStatus = await checkStreamStatus(src);
                if (newStatus?.isReady || (newStatus?.status ?? 0) >= 4) {
                  if (pollInterval) clearInterval(pollInterval);
                  if (!cancelled) {
                    setIsProcessing(false);
                    setUseIframeEmbed(true);
                    setStreamVideoId(videoId);
                    setPlaybackUrl(getBunnyStreamEmbedUrl(videoId));
                  }
                }
              }, 5000);
              
              return;
            }
            
            // Video is ready - use iframe embed (NOT CDN URL)
            if (!cancelled) {
              setUseIframeEmbed(true);
              setStreamVideoId(videoId);
              setPlaybackUrl(getBunnyStreamEmbedUrl(videoId));
            }
            return;
          }
        }

        // For regular video files with Supabase storage, get signed URL
        if (deliverableId && isRegularVideoFile(src)) {
          const signed = await getDeliverableSignedUrl(deliverableId, src);
          if (!signed) throw new Error('Could not create a signed URL');
          if (!cancelled) {
            setPlaybackUrl(signed);
            setIsHls(false);
          }
          return;
        }

        // Fallback: attempt to sign based on URL pattern (for Supabase storage)
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

        // Last resort: Use URL as-is (only for non-Stream URLs)
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

  // Setup HLS or native playback when URL is ready (only for non-iframe mode)
  useEffect(() => {
    if (!playbackUrl || !videoRef.current || useIframeEmbed) return;

    if (isHls) {
      initializeHls(playbackUrl, videoRef.current);
    } else {
      videoRef.current.src = playbackUrl;
    }
  }, [playbackUrl, isHls, initializeHls, useIframeEmbed]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    onTimeUpdate?.(videoRef.current.currentTime);
  };

  const handlePause = () => {
    onPause?.();
  };

  const handlePlay = () => {
    onPlay?.();
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

  // Use iframe embed for Bunny Stream videos - this is the correct way
  if (useIframeEmbed && streamVideoId) {
    return (
      <div className={cn('w-full h-full', className)}>
        <iframe
          ref={iframeRef}
          src={playbackUrl}
          className="w-full h-full rounded-lg"
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title="Video Player"
        />
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
        onPause={handlePause}
        onPlay={handlePlay}
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
});

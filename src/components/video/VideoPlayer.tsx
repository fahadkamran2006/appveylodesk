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
  
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (guidPattern.test(urlOrId)) return true;
  if (urlOrId.includes('.b-cdn.net/') && urlOrId.includes('/playlist.m3u8')) return true;
  
  const guidMatch = urlOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return !!guidMatch;
}

function extractBunnyStreamVideoId(url: string): string | null {
  if (!url) return null;
  
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (guidPattern.test(url)) return url;
  
  const hlsMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8/i);
  if (hlsMatch) return hlsMatch[1];
  
  const guidMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return guidMatch ? guidMatch[1] : null;
}

function getBunnyStreamEmbedUrl(videoId: string): string {
  // Enable responsive mode, disable autoplay, enable postMessage API for time tracking
  // Add preload and showControls to ensure player is interactive
  return `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}?autoplay=false&preload=true&responsive=true&loop=false&showControls=true`;
}

export function getBunnyStreamDownloadUrl(videoId: string): string {
  return `https://video.bunnycdn.com/play/${BUNNY_STREAM_LIBRARY_ID}/${videoId}/mp4_source`;
}

function isRegularVideoFile(url: string): boolean {
  if (!url) return false;
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  return ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext || '');
}

function extractDeliverablesPathFromUrl(fileUrl: string): string | null {
  if (!fileUrl) return null;

  if (!/^https?:\/\//i.test(fileUrl)) {
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
    
    const filePath = extractDeliverablesPathFromUrl(fileUrl);
    if (filePath) {
      const { data, error } = await supabase.storage
        .from('deliverables')
        .createSignedUrl(filePath, expiresIn);
      
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
    
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
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  src: string;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isHls, setIsHls] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useIframeEmbed, setUseIframeEmbed] = useState(false);
  const [streamVideoId, setStreamVideoId] = useState<string | null>(null);
  
  // Video state tracking
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);

  // Refs to track current time for imperative access
  const currentTimeRef = useRef(0);

  // Seek to a specific timestamp
  const seekTo = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      setCurrentTime(seconds);
      currentTimeRef.current = seconds;
      onSeekToComment?.(seconds);
    } else if (iframeRef.current && streamVideoId) {
      // Send seek command to Bunny iframe using Player.js standard
      // Try both formats for compatibility
      iframeRef.current.contentWindow?.postMessage({
        method: 'setCurrentTime',
        value: seconds
      }, '*');
      iframeRef.current.contentWindow?.postMessage({
        event: 'seek',
        time: seconds
      }, '*');
      setCurrentTime(seconds);
      currentTimeRef.current = seconds;
      onSeekToComment?.(seconds);
    }
  }, [streamVideoId, onSeekToComment]);

  // Expose methods for parent components
  useImperativeHandle(ref, () => ({
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPaused(true);
        // Update currentTimeRef with latest value from video element
        const time = videoRef.current.currentTime;
        currentTimeRef.current = time;
        setCurrentTime(time);
        onTimeUpdate?.(time);
      } else if (iframeRef.current && streamVideoId) {
        // Use Player.js standard with 'method' key
        iframeRef.current.contentWindow?.postMessage({ method: 'pause' }, '*');
        setIsPaused(true);
        // Request current time immediately after pause using Player.js standard
        iframeRef.current.contentWindow?.postMessage({ method: 'getCurrentTime' }, '*');
        // The current time from currentTimeRef should be fairly accurate due to polling
        // Notify parent of the current time
        onTimeUpdate?.(currentTimeRef.current);
        onPause?.();
      }
    },
    getCurrentTime: () => {
      if (videoRef.current) {
        // Always get fresh value from video element
        return videoRef.current.currentTime;
      }
      return currentTimeRef.current;
    },
    seekTo
  }));

  // Listen for Bunny Stream iframe messages
  useEffect(() => {
    if (!useIframeEmbed) return;

    const handleMessage = (event: MessageEvent) => {
      // Bunny Stream uses Player.js standard - sends various message formats
      const data = event.data;
      
      if (typeof data !== 'object' || !data) return;
      
      // Log all messages for debugging (helps troubleshoot iframe communication)
      if (data.event || data.method || data.name || data.seconds !== undefined || data.value !== undefined) {
        console.log('[BunnyStream Message]', data);
      }
      
      // Handle Player.js method responses: { method: 'getCurrentTime', value: X }
      if (data.method === 'getCurrentTime' && typeof data.value === 'number') {
        setCurrentTime(data.value);
        currentTimeRef.current = data.value;
        onTimeUpdate?.(data.value);
        return;
      }
      
      if (data.method === 'getDuration' && typeof data.value === 'number') {
        setDuration(data.value);
        return;
      }
      
      // Handle Player.js event responses: { event: 'timeupdate', data: { seconds: X, duration: Y } }
      if (data.event === 'timeupdate' && data.data) {
        const time = data.data.seconds ?? data.data.currentTime ?? 0;
        const dur = data.data.duration;
        if (typeof time === 'number' && time >= 0) {
          setCurrentTime(time);
          currentTimeRef.current = time;
          onTimeUpdate?.(time);
        }
        if (typeof dur === 'number' && dur > 0) {
          setDuration(dur);
        }
        return;
      }
      
      // Handle time updates from Bunny player - check all possible legacy formats
      const hasTimeData = 
        data.event === 'timeupdate' || 
        data.type === 'timeupdate' || 
        data.name === 'timeupdate' ||
        typeof data.currentTime === 'number' ||
        typeof data.time === 'number' ||
        typeof data.seconds === 'number';
        
      if (hasTimeData) {
        const time = data.currentTime ?? data.time ?? data.seconds ?? data.position ?? 0;
        if (typeof time === 'number' && time >= 0) {
          setCurrentTime(time);
          currentTimeRef.current = time;
          onTimeUpdate?.(time);
        }
      }
      
      // Handle duration info
      if (data.event === 'durationchange' || data.type === 'durationchange' || 
          data.name === 'durationchange' || typeof data.duration === 'number') {
        const dur = data.duration ?? 0;
        if (typeof dur === 'number' && dur > 0) {
          setDuration(dur);
        }
      }
      
      // Handle play/pause events from Bunny
      if (data.event === 'pause' || data.type === 'pause' || data.name === 'pause') {
        setIsPaused(true);
        // When paused, capture the current time and notify parent
        const time = data.currentTime ?? currentTimeRef.current;
        if (typeof time === 'number') {
          currentTimeRef.current = time;
          setCurrentTime(time);
          onTimeUpdate?.(time);
        }
        onPause?.();
      }
      if (data.event === 'play' || data.type === 'play' || 
          data.event === 'playing' || data.name === 'play' || data.name === 'playing') {
        setIsPaused(false);
        onPlay?.();
      }
      
      // Handle loaded metadata
      if ((data.event === 'loadedmetadata' || data.name === 'loadedmetadata') && data.duration) {
        setDuration(data.duration);
      }

      // Handle ready event - request initial time using Player.js standard
      if (data.event === 'ready' || data.name === 'ready') {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ method: 'getCurrentTime' }, '*');
          iframeRef.current.contentWindow.postMessage({ method: 'getDuration' }, '*');
          // Also listen for events by subscribing
          iframeRef.current.contentWindow.postMessage({ method: 'addEventListener', value: 'timeupdate' }, '*');
          iframeRef.current.contentWindow.postMessage({ method: 'addEventListener', value: 'pause' }, '*');
          iframeRef.current.contentWindow.postMessage({ method: 'addEventListener', value: 'play' }, '*');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [useIframeEmbed, onTimeUpdate, onPause, onPlay]);

  // Poll for time updates when using iframe (fallback for iframes that don't send events)
  useEffect(() => {
    if (!useIframeEmbed || !streamVideoId || !iframeRef.current) return;
    
    // Request current time from iframe periodically using Player.js standard
    const pollInterval = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        try {
          // Use Player.js standard 'method' key
          iframeRef.current.contentWindow.postMessage({ method: 'getCurrentTime' }, '*');
          iframeRef.current.contentWindow.postMessage({ method: 'getDuration' }, '*');
        } catch (e) {
          // Ignore cross-origin errors
        }
      }
    }, 200); // Poll frequently for better timestamp accuracy
    
    return () => clearInterval(pollInterval);
  }, [useIframeEmbed, streamVideoId]);

  // Cleanup HLS instance
  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Initialize HLS.js
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
        console.log('HLS manifest loaded');
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('Fatal HLS error:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
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
      setCurrentTime(0);
      setDuration(0);
      currentTimeRef.current = 0;

      try {
        // Check if it's a Bunny Stream video
        if (isBunnyStreamVideo(src)) {
          const videoId = extractBunnyStreamVideoId(src);
          console.log('Detected Bunny Stream video, ID:', videoId);
          
          if (videoId) {
            const status = await checkStreamStatus(src);
            
            if (status && !status.isReady && status.status < 4) {
              setIsProcessing(true);
              
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
            
            if (!cancelled) {
              setUseIframeEmbed(true);
              setStreamVideoId(videoId);
              setPlaybackUrl(getBunnyStreamEmbedUrl(videoId));
            }
            return;
          }
        }

        // For regular video files with Supabase storage
        if (deliverableId && isRegularVideoFile(src)) {
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

        // Last resort: Use URL as-is
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

  // Setup HLS or native playback
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
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    currentTimeRef.current = time;
    onTimeUpdate?.(time);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handlePause = () => {
    setIsPaused(true);
    onPause?.();
  };

  const handlePlay = () => {
    setIsPaused(false);
    onPlay?.();
  };

  // Handle clicking on timeline markers
  const handleMarkerClick = (timestamp: number) => {
    seekTo(timestamp);
    onSeekToComment?.(timestamp);
  };

  // Render comment markers on timeline
  const renderCommentMarkers = () => {
    if (!showCommentMarkers || !comments || comments.length === 0 || duration <= 0) {
      return null;
    }

    // Get unique timestamps (dedupe comments at same second)
    const uniqueTimestamps = [...new Set(comments.map(c => Math.floor(c.timestamp_seconds)))];

    return (
      <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-10">
        {uniqueTimestamps.map((timestamp) => {
          const position = (timestamp / duration) * 100;
          const commentsAtTime = comments.filter(c => Math.floor(c.timestamp_seconds) === timestamp);
          const hasUnresolved = commentsAtTime.some(c => !c.is_resolved);
          
          return (
            <button
              key={timestamp}
              onClick={(e) => {
                e.stopPropagation();
                handleMarkerClick(timestamp);
              }}
              className={cn(
                "absolute bottom-1 w-3 h-3 rounded-full transform -translate-x-1/2 pointer-events-auto transition-all hover:scale-150 z-20",
                hasUnresolved 
                  ? "bg-primary shadow-lg shadow-primary/50" 
                  : "bg-muted-foreground/50"
              )}
              style={{ left: `${position}%` }}
              title={`${commentsAtTime.length} comment${commentsAtTime.length > 1 ? 's' : ''} at ${formatTime(timestamp)}`}
            />
          );
        })}
      </div>
    );
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
            This video is being transcoded. This may take a few minutes.
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

  // Handle iframe load - request initial data and subscribe to events
  const handleIframeLoad = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      // Give the player a moment to initialize, then request time/duration and subscribe to events
      setTimeout(() => {
        try {
          const win = iframeRef.current?.contentWindow;
          if (!win) return;
          
          // Player.js standard - request current state
          win.postMessage({ method: 'getCurrentTime' }, '*');
          win.postMessage({ method: 'getDuration' }, '*');
          
          // Subscribe to events using Player.js standard
          win.postMessage({ method: 'addEventListener', value: 'timeupdate' }, '*');
          win.postMessage({ method: 'addEventListener', value: 'pause' }, '*');
          win.postMessage({ method: 'addEventListener', value: 'play' }, '*');
          win.postMessage({ method: 'addEventListener', value: 'ended' }, '*');
          
          console.log('[VideoPlayer] Subscribed to Bunny iframe events');
        } catch (e) {
          console.log('Could not send initial postMessage to iframe:', e);
        }
      }, 500);
    }
  }, []);

  // Bunny Stream iframe embed
  if (useIframeEmbed && streamVideoId) {
    return (
      <div ref={containerRef} className={cn('w-full h-full relative', className)}>
        <iframe
          ref={iframeRef}
          src={playbackUrl}
          className="w-full h-full rounded-lg"
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title="Video Player"
          onLoad={handleIframeLoad}
        />
        {/* Comment markers overlay */}
        {renderCommentMarkers()}
        {/* Current time display for debugging/visibility */}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {formatTime(currentTime)} / {formatTime(duration || 0)}
        </div>
      </div>
    );
  }

  const mimeType = isHls ? 'application/vnd.apple.mpegurl' : guessVideoMimeType(src);

  // Native video player
  return (
    <div ref={containerRef} className={cn('w-full h-full relative', className)}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain rounded-lg"
        controls
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
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
      {/* Comment markers overlay for native video */}
      {renderCommentMarkers()}
    </div>
  );
});

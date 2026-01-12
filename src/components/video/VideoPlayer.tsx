import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipBack, 
  SkipForward,
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import { VideoComment } from '@/hooks/useVideoComments';
import { supabase } from '@/integrations/supabase/client';

interface VideoPlayerProps {
  src: string;
  comments: VideoComment[];
  onTimeUpdate?: (time: number) => void;
  onSeekToComment?: (timestamp: number) => void;
  onAddComment?: (timestamp: number) => void;
  showCommentMarkers?: boolean;
  className?: string;
}

export function VideoPlayer({
  src,
  comments,
  onTimeUpdate,
  onSeekToComment,
  onAddComment,
  showCommentMarkers = true,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Get signed URL for private bucket files
  useEffect(() => {
    const getSignedUrl = async () => {
      if (!src) return;

      // Check if this is a Supabase storage URL that needs signing
      // Matches both /object/public/deliverables/ and /object/deliverables/ patterns
      const storagePattern = /\/storage\/v1\/object\/(?:public\/)?deliverables\//;
      if (storagePattern.test(src)) {
        // Extract file path from URL - handle both public and authenticated URL patterns
        const urlParts = src.split(/\/deliverables\//);
        if (urlParts.length >= 2) {
          // The path may have query params, remove them
          const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
          
          // Get signed URL for the bucket (works for both public and private)
          const { data, error } = await supabase.storage
            .from('deliverables')
            .createSignedUrl(filePath, 3600); // 1 hour expiry

          if (error) {
            console.error('Error getting signed URL:', error);
            // If the file is not found, show a more helpful error
            if (error.message?.includes('Object not found') || (error as any).statusCode === '404') {
              setVideoError('Video file not found. It may have been moved or deleted.');
            } else {
              setVideoError('Could not load video. Please try again.');
            }
            return;
          }

          setSignedUrl(data.signedUrl);
          setVideoError(null);
          return;
        }
      }

      // Use the original URL if it's not a storage URL
      setSignedUrl(src);
      setVideoError(null);
    };

    getSignedUrl();
  }, [src]);

  // Format time to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Seek to position
  const handleSeek = useCallback((value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  }, []);

  // Volume control
  const handleVolumeChange = useCallback((value: number[]) => {
    if (videoRef.current) {
      videoRef.current.volume = value[0];
      setVolume(value[0]);
      setIsMuted(value[0] === 0);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  }, [currentTime, duration]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (containerRef.current) {
      if (isFullscreen) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  }, [isFullscreen]);

  // Seek to comment timestamp
  const seekToTimestamp = useCallback((timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      setCurrentTime(timestamp);
      onSeekToComment?.(timestamp);
    }
  }, [onSeekToComment]);

  // Add comment at current time
  const handleAddComment = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      onAddComment?.(currentTime);
    }
  }, [currentTime, onAddComment]);

  // Handle time update
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Calculate comment marker positions
  const unresolvedComments = comments.filter(c => !c.is_resolved);
  const commentMarkers = unresolvedComments.map(c => ({
    id: c.id,
    position: duration > 0 ? (c.timestamp_seconds / duration) * 100 : 0,
    timestamp: c.timestamp_seconds,
  }));

  // Show error state
  if (videoError) {
    return (
      <div
        className={cn(
          'relative bg-black rounded-lg overflow-hidden flex items-center justify-center',
          className
        )}
      >
        <div className="text-center text-white p-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="text-lg font-medium mb-2">Video Playback Error</p>
          <p className="text-sm text-muted-foreground">{videoError}</p>
        </div>
      </div>
    );
  }

  // Show loading state while getting signed URL
  if (!signedUrl) {
    return (
      <div
        className={cn(
          'relative bg-black rounded-lg overflow-hidden flex items-center justify-center',
          className
        )}
      >
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm">Loading video...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black rounded-lg overflow-hidden group',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={signedUrl}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        playsInline
        onError={(e) => {
          console.error('Video error:', e);
          setVideoError('Failed to load video. The file may be corrupted or in an unsupported format.');
        }}
      />

      {/* Controls overlay */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-end transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        {/* Timeline with markers */}
        <div className="relative px-4 pb-2">
          {/* Comment markers */}
          {showCommentMarkers && commentMarkers.map(marker => (
            <button
              key={marker.id}
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full hover:scale-125 transition-transform z-10 cursor-pointer"
              style={{ left: `${marker.position}%` }}
              onClick={() => seekToTimestamp(marker.timestamp)}
              title={`Comment at ${formatTime(marker.timestamp)}`}
            />
          ))}

          {/* Progress slider */}
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-2 px-4 pb-4">
          {/* Play/Pause */}
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlay}
            className="text-white hover:bg-white/20"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>

          {/* Skip buttons */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(-10)}
            className="text-white hover:bg-white/20"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(10)}
            className="text-white hover:bg-white/20"
          >
            <SkipForward className="w-4 h-4" />
          </Button>

          {/* Time display */}
          <span className="text-white text-sm font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Add comment button */}
          {onAddComment && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddComment}
              className="text-white hover:bg-white/20"
              title="Add comment at current time"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
          )}

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-white hover:bg-white/20"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              min={0}
              max={1}
              step={0.1}
              onValueChange={handleVolumeChange}
              className="w-20"
            />
          </div>

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-white hover:bg-white/20"
          >
            <Maximize className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Play button overlay when paused */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
        >
          <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-8 h-8 text-primary-foreground ml-1" />
          </div>
        </button>
      )}
    </div>
  );
}

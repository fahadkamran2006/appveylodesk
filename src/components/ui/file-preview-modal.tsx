import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X,
  Download,
  Pencil,
  Check,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Bunny Stream Library ID
const BUNNY_STREAM_LIBRARY_ID = '582147';

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    file_name: string;
    file_url: string;
    file_size?: number;
  } | null;
  onDownload?: () => void;
  onRename?: (newName: string) => Promise<boolean>;
  canRename?: boolean;
}

function isBunnyCdnUrl(url: string): boolean {
  return url.includes('b-cdn.net') || url.includes('bunnycdn');
}

// Check if URL/ID is a Bunny Stream video (GUID format)
function isBunnyStreamVideo(urlOrId: string): boolean {
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (urlOrId.includes('.b-cdn.net/') && urlOrId.includes('/playlist.m3u8')) {
    return true;
  }
  
  if (guidPattern.test(urlOrId)) {
    return true;
  }
  
  const guidMatch = urlOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (guidMatch && (urlOrId.includes('bunny') || urlOrId.includes('b-cdn.net') || urlOrId.includes('mediadelivery'))) {
    return true;
  }
  
  return false;
}

// Extract video ID from Bunny Stream URL
function extractBunnyStreamVideoId(url: string): string | null {
  const hlsMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8/i);
  if (hlsMatch) return hlsMatch[1];
  
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (guidPattern.test(url)) return url;
  
  const guidMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (guidMatch) return guidMatch[1];
  
  return null;
}

// Generate Bunny Stream embed URL
function getBunnyStreamEmbedUrl(videoId: string): string {
  return `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}?autoplay=false&preload=true`;
}

// Generate Bunny Stream MP4 download URL
function getBunnyStreamDownloadUrl(videoId: string): string {
  return `https://video.bunnycdn.com/play/${BUNNY_STREAM_LIBRARY_ID}/${videoId}/mp4_source`;
}

async function getSignedUrl(deliverableId: string): Promise<{ url: string | null; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('deliverables-ops', {
      body: { action: 'signed_url', deliverableId, expiresIn: 3600 },
    });

    if (error) throw error;
    if (!data) return { url: null };
    if ((data as any).error) {
      return { url: null, error: (data as any).error };
    }

    return { url: (data as any).signedUrl ?? null };
  } catch (e: any) {
    console.error('Error getting signed URL:', e);
    return { url: null, error: e?.message ?? 'Failed to load file' };
  }
}

async function checkStreamStatus(fileUrl: string): Promise<{ isReady: boolean; status: number } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('bunny-ops', {
      body: { action: 'stream_status', fileUrl },
    });
    
    if (error || !data?.ok) return null;
    return { isReady: data.isReady, status: data.status };
  } catch {
    return null;
  }
}

export function FilePreviewModal({
  open,
  onOpenChange,
  file,
  onDownload,
  onRename,
  canRename = false,
}: FilePreviewModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isStreamVideo, setIsStreamVideo] = useState(false);
  const [streamVideoId, setStreamVideoId] = useState<string | null>(null);
  const [isVideoProcessing, setIsVideoProcessing] = useState(false);

  // Reset editing state & zoom/rotation when file changes
  useEffect(() => {
    if (file) {
      setNewName(file.file_name);
      setZoom(1);
      setRotation(0);
    }
    setIsEditing(false);
  }, [file]);

  // Resolve URL when file changes
  useEffect(() => {
    let cancelled = false;

    const resolveUrl = async () => {
      if (!file) {
        setResolvedUrl(null);
        setUrlError(null);
        setIsStreamVideo(false);
        setStreamVideoId(null);
        setIsVideoProcessing(false);
        return;
      }

      // Check if it's a Bunny Stream video
      if (isBunnyStreamVideo(file.file_url)) {
        const videoId = extractBunnyStreamVideoId(file.file_url);
        console.log('Detected Bunny Stream video in preview, ID:', videoId);
        
        if (videoId) {
          setIsResolvingUrl(true);
          
          // Check processing status
          const status = await checkStreamStatus(file.file_url);
          
          if (!cancelled) {
            if (status && !status.isReady && status.status < 4) {
              setIsVideoProcessing(true);
              setIsStreamVideo(true);
              setStreamVideoId(videoId);
              setResolvedUrl(null);
            } else {
              setIsVideoProcessing(false);
              setIsStreamVideo(true);
              setStreamVideoId(videoId);
              setResolvedUrl(getBunnyStreamEmbedUrl(videoId));
            }
            setIsResolvingUrl(false);
          }
          return;
        }
      }

      // Bunny CDN URLs can be used directly
      if (isBunnyCdnUrl(file.file_url)) {
        console.log('Using Bunny CDN URL directly for preview:', file.file_url);
        setResolvedUrl(file.file_url);
        setIsResolvingUrl(false);
        setIsStreamVideo(false);
        setStreamVideoId(null);
        return;
      }

      // For Supabase storage, get signed URL
      setIsResolvingUrl(true);
      setUrlError(null);
      setIsStreamVideo(false);
      setStreamVideoId(null);
      try {
        const result = await getSignedUrl(file.id);
        if (!cancelled) {
          if (result.error) {
            setUrlError(result.error);
            setResolvedUrl(null);
          } else {
            setResolvedUrl(result.url ?? file.file_url);
          }
        }
      } catch {
        if (!cancelled) {
          setResolvedUrl(file.file_url);
        }
      } finally {
        if (!cancelled) setIsResolvingUrl(false);
      }
    };

    resolveUrl();
    return () => {
      cancelled = true;
    };
  }, [file?.id, file?.file_url]);

  if (!file) return null;

  const previewUrl = resolvedUrl ?? file.file_url;

  const ext = file.file_name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  const isVideo = ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext) || isStreamVideo;
  const isAudio = ['mp3', 'wav', 'aac', 'm4a'].includes(ext);
  const isPdf = ext === 'pdf';

  const handleRename = async () => {
    if (!onRename || !newName.trim() || newName === file.file_name) {
      setIsEditing(false);
      return;
    }

    setIsRenaming(true);
    const success = await onRename(newName.trim());
    setIsRenaming(false);

    if (success) {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setNewName(file.file_name);
      setIsEditing(false);
    }
  };

  const handleDownload = () => {
    // For Bunny Stream videos, use the MP4 download URL
    if (isStreamVideo && streamVideoId) {
      const downloadUrl = getBunnyStreamDownloadUrl(streamVideoId);
      window.open(downloadUrl, '_blank');
      return;
    }
    
    // For other files, use the provided onDownload handler
    onDownload?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                  autoFocus
                  disabled={isRenaming}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleRename}
                  disabled={isRenaming}
                >
                  {isRenaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setNewName(file.file_name);
                    setIsEditing(false);
                  }}
                  disabled={isRenaming}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <DialogTitle className="truncate">{file.file_name}</DialogTitle>
                {isVideoProcessing && (
                  <span className="text-xs bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-full">
                    Processing...
                  </span>
                )}
                {canRename && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                    className="shrink-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {isImage && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </>
            )}
            {(onDownload || (isStreamVideo && streamVideoId)) && !isVideoProcessing && (
              <Button size="icon" variant="ghost" onClick={handleDownload}>
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/30 min-h-[400px] relative">
          {isResolvingUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Preparing preview…</span>
              </div>
            </div>
          )}

          {urlError && !isResolvingUrl && (
            <div className="flex flex-col items-center gap-3 text-center p-8">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-medium text-foreground">File Unavailable</h3>
              <p className="text-sm text-muted-foreground max-w-md">{urlError}</p>
            </div>
          )}

          {isVideoProcessing && !isResolvingUrl && (
            <div className="flex flex-col items-center gap-3 text-center p-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <h3 className="text-lg font-medium text-foreground">Video Processing</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                This video is being transcoded for optimal playback. Please check back in a few minutes.
              </p>
            </div>
          )}

          {!urlError && !isVideoProcessing && isImage && (
            <img
              src={previewUrl}
              alt={file.file_name}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          )}

          {!urlError && !isVideoProcessing && isVideo && isStreamVideo && streamVideoId && (
            <iframe
              src={resolvedUrl || getBunnyStreamEmbedUrl(streamVideoId)}
              className="w-full h-full min-h-[400px] rounded-lg"
              loading="lazy"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title="Video Player"
            />
          )}

          {!urlError && !isVideoProcessing && isVideo && !isStreamVideo && (
            <video
              src={previewUrl}
              controls
              playsInline
              className="max-w-full max-h-full"
            >
              Your browser does not support video playback.
            </video>
          )}

          {!urlError && isAudio && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary" />
                </div>
              </div>
              <audio src={previewUrl} controls className="w-full max-w-md">
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {!urlError && isPdf && (
            <iframe
              src={previewUrl}
              className="w-full h-full min-h-[500px]"
              title={file.file_name}
            />
          )}

          {!urlError && !isVideoProcessing && !isImage && !isVideo && !isAudio && !isPdf && (
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">Preview not available</p>
              <p className="text-sm">Click download to view this file</p>
              {(onDownload || (isStreamVideo && streamVideoId)) && (
                <Button onClick={handleDownload} className="mt-4">
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

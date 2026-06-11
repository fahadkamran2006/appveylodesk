import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Upload, 
  File, 
  Video, 
  Image, 
  FileText, 
  Music, 
  Archive,
  Trash2,
  Download,
  Eye,
  Loader2,
  Lock,
  Pencil
} from 'lucide-react';
import { Deliverable, useStorage } from '@/hooks/useStorage';
import { useToast } from '@/hooks/use-toast';
import { useUploadContext } from '@/contexts/UploadContext';
import { format } from 'date-fns';
import { isDefinitelyBunnyStreamUrl } from '@/lib/bunnyStream';
import { supabase } from '@/integrations/supabase/client';
import { useDownloadContext } from '@/contexts/DownloadContext';
import { useRemoteUploads } from '@/hooks/useRemoteUploads';
import { RemoteUploadCard } from '@/components/projects/RemoteUploadCard';

interface FileManagerProps {
  projectId: string;
  deliverables: Deliverable[];
  canUpload: boolean;
  canDelete: boolean;
  onFileUploaded: () => void;
  onFileDeleted: () => void;
  onViewVideo: (deliverable: Deliverable) => void;
  className?: string;
  fileType?: 'asset' | 'deliverable';
  emptyTitle?: string;
  emptyDescription?: string;
  uploadLabel?: string;
  userRole?: string;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '')) {
    return <Video className="w-5 h-5 text-primary" />;
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
    return <Image className="w-5 h-5 text-accent" />;
  }
  if (['mp3', 'wav', 'aac'].includes(ext || '')) {
    return <Music className="w-5 h-5 text-warning" />;
  }
  if (['zip', 'rar', '7z'].includes(ext || '')) {
    return <Archive className="w-5 h-5 text-muted-foreground" />;
  }
  if (['pdf'].includes(ext || '')) {
    return <FileText className="w-5 h-5 text-destructive" />;
  }
  
  return <File className="w-5 h-5 text-muted-foreground" />;
};

const isVideoFile = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '');
};

const isImageFile = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp'].includes(ext || '');
};

const isAudioFile = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(ext || '');
};

export function FileManager({
  projectId,
  deliverables,
  canUpload,
  canDelete,
  onFileUploaded,
  onFileDeleted,
  onViewVideo,
  className,
  fileType = 'deliverable',
  emptyTitle = 'No files yet',
  emptyDescription,
  uploadLabel = 'Click to upload files',
  userRole,
}: FileManagerProps) {
  const { deleteDeliverable, formatBytes, loading } = useStorage();
  const { toast } = useToast();
  const { addToQueue } = useUploadContext();
  const { startDownload } = useDownloadContext();
  const remoteUploads = useRemoteUploads(projectId);
  const [deleteTarget, setDeleteTarget] = useState<Deliverable | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Use the global upload queue (presigned/TUS flow) for reliable large file uploads
    addToQueue(Array.from(files), projectId, undefined, fileType);
    
    // Notify parent that files were queued (they'll appear when upload completes)
    onFileUploaded();

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [projectId, addToQueue, onFileUploaded, fileType]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    const success = await deleteDeliverable(deleteTarget);
    setIsDeleting(false);
    setDeleteTarget(null);

    if (success) {
      onFileDeleted();
    }
  }, [deleteTarget, deleteDeliverable, onFileDeleted]);

  const handleDownload = useCallback((deliverable: Deliverable) => {
    startDownload(deliverable.id, deliverable.file_name, deliverable.file_url, deliverable.file_size || undefined);
  }, [startDownload]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Upload area - simplified since uploads go to global queue */}
      {canUpload && (
        <div className="p-4 border-b border-border">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="video/*,image/*,audio/*,.pdf,.zip"
          />
          
          <Button
            variant="outline"
            className="w-full h-20 border-dashed"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-5 h-5" />
              <span className="text-sm">{uploadLabel}</span>
              <span className="text-xs text-muted-foreground">
                Video, images, audio, PDF, or ZIP
              </span>
            </div>
          </Button>
        </div>
      )}

      {/* File list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {/* Remote upload indicators (other users uploading) */}
          {remoteUploads.length > 0 && (
            <div className="space-y-2 mb-3">
              {remoteUploads.map(upload => (
                <RemoteUploadCard key={upload.id} upload={upload} />
              ))}
            </div>
          )}

          {deliverables.length === 0 && remoteUploads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <File className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">{emptyTitle}</p>
              <p className="text-xs">
                {emptyDescription || (canUpload ? 'Upload your first file' : 'No files have been uploaded')}
              </p>
            </div>
          ) : deliverables.length === 0 && remoteUploads.length > 0 ? (
            null // Just show the remote uploads above
          ) : (
            deliverables.map(deliverable => {
              const showImagePreview = isImageFile(deliverable.file_name);
              const showAudioPreview = isAudioFile(deliverable.file_name);
              return (
              <div
                key={deliverable.id}
                className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                {/* Icon or thumbnail */}
                <div className="shrink-0">
                  {showImagePreview ? (
                    <img
                      src={deliverable.file_url}
                      alt={deliverable.file_name}
                      loading="lazy"
                      className="w-12 h-12 rounded object-cover border border-border"
                    />
                  ) : (
                    getFileIcon(deliverable.file_name)
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {deliverable.file_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {deliverable.file_size && (
                      <span>{formatBytes(deliverable.file_size)}</span>
                    )}
                    {deliverable.version && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        v{deliverable.version}
                      </Badge>
                    )}
                    {deliverable.is_locked && (
                      <Badge variant="outline" className="text-[10px] h-4 text-warning border-warning/30">
                        <Lock className="w-2.5 h-2.5 mr-0.5" />
                        Locked
                      </Badge>
                    )}
                    <span>by {deliverable.uploader_name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(deliverable.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isVideoFile(deliverable.file_name) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewVideo(deliverable)}
                      title="Review video"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  {deliverable.is_locked && userRole === 'client' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        toast({
                          title: 'Download locked',
                          description: 'Payment required — please complete payment before downloading this file.',
                          variant: 'destructive',
                        });
                      }}
                      title="Payment required to download"
                      className="text-warning hover:text-warning"
                    >
                      <Lock className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(deliverable)}
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(deliverable)}
                      className="text-destructive hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                </div>
                {showAudioPreview && (
                  <audio
                    controls
                    preload="none"
                    src={deliverable.file_url}
                    className="w-full h-9"
                  />
                )}
              </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.file_name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  X, 
  Download, 
  Pencil, 
  Check, 
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    if (file) {
      setNewName(file.file_name);
      setZoom(1);
      setRotation(0);
    }
    setIsEditing(false);
  }, [file]);

  if (!file) return null;

  const ext = file.file_name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  const isVideo = ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext);
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
            {onDownload && (
              <Button size="icon" variant="ghost" onClick={onDownload}>
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/30 min-h-[400px]">
          {isImage && (
            <img
              src={file.file_url}
              alt={file.file_name}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          )}

          {isVideo && (
            <video
              src={file.file_url}
              controls
              className="max-w-full max-h-full"
              autoPlay={false}
            >
              Your browser does not support video playback.
            </video>
          )}

          {isAudio && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary" />
                </div>
              </div>
              <audio src={file.file_url} controls className="w-full max-w-md">
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {isPdf && (
            <iframe
              src={file.file_url}
              className="w-full h-full min-h-[500px]"
              title={file.file_name}
            />
          )}

          {!isImage && !isVideo && !isAudio && !isPdf && (
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">Preview not available</p>
              <p className="text-sm">Click download to view this file</p>
              {onDownload && (
                <Button onClick={onDownload} className="mt-4">
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

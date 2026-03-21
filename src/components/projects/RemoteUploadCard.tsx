import { Upload, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { RemoteUploadIndicator } from '@/hooks/useRemoteUploads';

interface RemoteUploadCardProps {
  upload: RemoteUploadIndicator;
}

export function RemoteUploadCard({ upload }: RemoteUploadCardProps) {
  const isComplete = upload.status === 'completed';

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
      {/* Animated icon */}
      <div className="shrink-0">
        {isComplete ? (
          <Upload className="w-5 h-5 text-primary" />
        ) : (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">
          {upload.fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {upload.uploaderName} is uploading...
        </p>
        {upload.progress > 0 && upload.progress < 100 && (
          <Progress value={upload.progress} className="h-1 mt-1.5" />
        )}
        {isComplete && (
          <p className="text-xs text-primary mt-0.5">Upload complete</p>
        )}
      </div>
    </div>
  );
}

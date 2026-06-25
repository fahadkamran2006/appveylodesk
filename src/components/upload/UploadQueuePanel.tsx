import { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  X,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  File,
  Video,
  Image,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GripVertical,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { QueuedUpload } from '@/hooks/useUploadQueue';

interface UploadQueuePanelProps {
  queue: QueuedUpload[];
  isProcessing: boolean;
  isPaused: boolean;
  onPauseQueue: () => void;
  onResumeQueue: () => void;
  onPauseUpload: (id: string) => void;
  onResumeUpload: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onClearCompleted: () => void;
  onCancelAll: () => void;
  formatBytes: (bytes: number) => string;
  formatTimeRemaining: (seconds: number) => string;
  stats: {
    pending: number;
    uploading: number;
    paused: number;
    completed: number;
    failed: number;
    total: number;
    totalSize: number;
    uploadedSize: number;
  };
}

export function UploadQueuePanel({
  queue,
  isProcessing,
  isPaused,
  onPauseQueue,
  onResumeQueue,
  onPauseUpload,
  onResumeUpload,
  onRemove,
  onRetry,
  onReorder,
  onClearCompleted,
  onCancelAll,
  formatBytes,
  formatTimeRemaining,
  stats,
}: UploadQueuePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '')) {
      return <Video className="w-4 h-4 text-primary" />;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <Image className="w-4 h-4 text-success" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-warning" />;
    }
    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusIcon = (status: QueuedUpload['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-warning" />;
      default:
        return null;
    }
  };

  const overallProgress = stats.totalSize > 0 
    ? Math.round((stats.uploadedSize / stats.totalSize) * 100)
    : 0;

  if (queue.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] bg-surface-elevated border border-border rounded-xl shadow-2xl z-[100] overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium text-foreground text-sm">
              Upload Queue
              {isProcessing && !isPaused && (
                <span className="ml-2 text-xs text-primary">Uploading...</span>
              )}
              {isPaused && (
                <span className="ml-2 text-xs text-warning">Paused</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.completed}/{stats.total} completed • {formatBytes(stats.uploadedSize)} / {formatBytes(stats.totalSize)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Overall Progress */}
      <Progress value={overallProgress} className="h-1 rounded-none" />

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {/* Controls */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/10">
              <div className="flex items-center gap-2">
                {isPaused ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResumeQueue();
                    }}
                    className="h-7 text-xs"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Resume All
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPauseQueue();
                    }}
                    className="h-7 text-xs"
                    disabled={!isProcessing}
                  >
                    <Pause className="w-3 h-3 mr-1" />
                    Pause All
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {stats.completed > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearCompleted();
                    }}
                    className="h-7 text-xs text-muted-foreground"
                  >
                    Clear Done
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelAll();
                  }}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancel All
                </Button>
              </div>
            </div>

            {/* Queue List */}
            <div className="max-h-80 overflow-y-auto">
              <Reorder.Group
                axis="y"
                values={queue}
                onReorder={(newOrder) => {
                  // Find which item moved and from/to indices
                  const oldIds = queue.map(q => q.id);
                  const newIds = newOrder.map(q => q.id);
                  
                  for (let i = 0; i < oldIds.length; i++) {
                    if (oldIds[i] !== newIds[i]) {
                      const movedId = newIds[i];
                      const fromIndex = oldIds.indexOf(movedId);
                      onReorder(fromIndex, i);
                      break;
                    }
                  }
                }}
                className="divide-y divide-border/30"
              >
                {queue.map((item, index) => (
                  <Reorder.Item
                    key={item.id}
                    value={item}
                    className={cn(
                      "flex items-center gap-3 p-3 bg-background hover:bg-muted/20 transition-colors",
                      item.status === 'uploading' && "bg-primary/5",
                      item.status === 'failed' && "bg-destructive/5",
                      item.status === 'completed' && "opacity-60"
                    )}
                    dragListener={item.status === 'pending' || item.status === 'paused'}
                  >
                    {/* Drag Handle */}
                    {(item.status === 'pending' || item.status === 'paused') && (
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                    )}
                    {(item.status !== 'pending' && item.status !== 'paused') && (
                      <div className="w-4 shrink-0" />
                    )}

                    {/* File Icon */}
                    <div className="shrink-0">
                      {getFileIcon(item.file.name)}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.file.name}
                        </p>
                        {getStatusIcon(item.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatBytes(item.file.size)}</span>
                        {item.projectTitle && (
                          <>
                            <span>•</span>
                            <span className="truncate">{item.projectTitle}</span>
                          </>
                        )}
                      </div>
                      
                      {/* Progress */}
                      {(item.status === 'uploading' || item.status === 'paused') && (
                        <div className="mt-2 space-y-1">
                          <Progress value={item.progress} className="h-1" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{item.progress}%</span>
                            {item.status === 'uploading' && item.speed > 0 && (
                              <span>
                                {formatBytes(item.speed)}/s • {formatTimeRemaining(item.remainingTime)} left
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {item.status === 'failed' && item.error && (
                        <p className="text-xs text-destructive mt-1 truncate">
                          {item.error}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === 'uploading' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onPauseUpload(item.id)}
                        >
                          <Pause className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status === 'paused' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onResumeUpload(item.id)}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onRetry(item.id)}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status !== 'uploading' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemove(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

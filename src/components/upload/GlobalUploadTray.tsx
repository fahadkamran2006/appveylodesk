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
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUploadContext, QueuedUpload } from '@/contexts/UploadContext';

export function GlobalUploadTray() {
  const {
    queue,
    isProcessing,
    isPaused,
    isMinimized,
    setIsMinimized,
    pauseQueue,
    resumeQueue,
    pauseUpload,
    resumeUpload,
    removeFromQueue,
    retryUpload,
    reorderQueue,
    clearCompleted,
    cancelAll,
    getQueueStats,
    formatBytes,
    formatTimeRemaining,
  } = useUploadContext();

  const [isExpanded, setIsExpanded] = useState(true);
  const stats = getQueueStats();

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

  // Minimized view - just a small floating button
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="h-14 w-14 rounded-full shadow-2xl relative"
          size="icon"
        >
          <Upload className="w-6 h-6" />
          {isProcessing && !isPaused && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary animate-pulse" />
          )}
          <span className="absolute -bottom-1 -left-1 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center text-xs font-medium">
            {stats.total - stats.completed}
          </span>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] bg-surface-elevated border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
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
                      resumeQueue();
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
                      pauseQueue();
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
                      clearCompleted();
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
                    cancelAll();
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
                  const oldIds = queue.map(q => q.id);
                  const newIds = newOrder.map(q => q.id);
                  
                  for (let i = 0; i < oldIds.length; i++) {
                    if (oldIds[i] !== newIds[i]) {
                      const movedId = newIds[i];
                      const fromIndex = oldIds.indexOf(movedId);
                      reorderQueue(fromIndex, i);
                      break;
                    }
                  }
                }}
                className="divide-y divide-border/30"
              >
                {queue.map((item) => (
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
                          onClick={() => pauseUpload(item.id)}
                        >
                          <Pause className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status === 'paused' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => resumeUpload(item.id)}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => retryUpload(item.id)}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status !== 'uploading' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFromQueue(item.id)}
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

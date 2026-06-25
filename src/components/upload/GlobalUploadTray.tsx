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
import { cn } from '@/lib/utils';
import { useUploadContext, QueuedUpload } from '@/contexts/UploadContext';

function MiniProgress({ value }: { value: number }) {
  return (
    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || ''))
    return <Video className="w-4 h-4 text-primary" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || ''))
    return <Image className="w-4 h-4 text-emerald-400" />;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext || ''))
    return <FileText className="w-4 h-4 text-amber-400" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function StatusBadge({ status }: { status: QueuedUpload['status'] }) {
  switch (status) {
    case 'uploading':
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />;
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'failed':
      return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
    case 'paused':
      return <Pause className="w-3.5 h-3.5 text-amber-400" />;
    default:
      return <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30" />;
  }
}

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

  const overallProgress = stats.totalSize > 0
    ? Math.round((stats.uploadedSize / stats.totalSize) * 100)
    : 0;

  if (queue.length === 0) return null;

  // Minimized FAB
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-4 right-4 z-[100]"
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="h-12 w-12 rounded-full shadow-xl relative bg-primary hover:bg-primary/90"
          size="icon"
        >
          <Upload className="w-5 h-5" />
          {isProcessing && !isPaused && (
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400"
            />
          )}
          <span className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-bold text-foreground">
            {stats.total - stats.completed}
          </span>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed bottom-4 right-4 w-[360px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-sm"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Upload className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground text-sm">Uploads</p>
              {isProcessing && !isPaused && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              )}
              {isPaused && (
                <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                  Paused
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {stats.completed}/{stats.total} done · {overallProgress}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
          <div className="w-6 h-6 flex items-center justify-center text-muted-foreground">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <MiniProgress value={overallProgress} />

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Quick actions */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/50">
              <div>
                {isPaused ? (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); resumeQueue(); }} className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground">
                    <Play className="w-3 h-3 mr-1" /> Resume
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); pauseQueue(); }} className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground" disabled={!isProcessing}>
                    <Pause className="w-3 h-3 mr-1" /> Pause
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-1">
                {stats.completed > 0 && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearCompleted(); }} className="h-6 text-[11px] px-2 text-muted-foreground">
                    Clear done
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); cancelAll(); }} className="h-6 text-[11px] px-2 text-destructive/70 hover:text-destructive">
                  <X className="w-3 h-3 mr-1" /> Cancel all
                </Button>
              </div>
            </div>

            {/* File list */}
            <div className="max-h-72 overflow-y-auto">
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
                className="px-1 py-1 space-y-0.5"
              >
                {queue.map((item) => (
                  <Reorder.Item
                    key={item.id}
                    value={item}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors",
                      item.status === 'uploading' && "bg-primary/5",
                      item.status === 'failed' && "bg-destructive/5",
                      item.status === 'completed' && "opacity-50",
                      item.status === 'pending' && "hover:bg-muted/30",
                    )}
                    dragListener={item.status === 'pending' || item.status === 'paused'}
                  >
                    {/* Drag handle or spacer */}
                    {(item.status === 'pending' || item.status === 'paused') ? (
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing shrink-0" />
                    ) : (
                      <div className="w-3.5 shrink-0" />
                    )}

                    {/* Icon */}
                    <div className="shrink-0">
                      <FileIcon name={item.file.name} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                          {item.file.name}
                        </p>
                        <StatusBadge status={item.status} />
                      </div>

                      {item.status === 'uploading' || item.status === 'paused' ? (
                        <div className="mt-1.5 space-y-0.5">
                          <MiniProgress value={item.progress} />
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{item.progress}%</span>
                            {item.status === 'uploading' && item.speed > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatBytes(item.speed)}/s · {formatTimeRemaining(item.remainingTime)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatBytes(item.file.size)}
                          {item.projectTitle && <> · {item.projectTitle}</>}
                        </p>
                      )}

                      {item.status === 'failed' && item.error && (
                        <p className="text-[10px] text-destructive mt-0.5 truncate">{item.error}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      {item.status === 'uploading' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => pauseUpload(item.id)}>
                          <Pause className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status === 'paused' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => resumeUpload(item.id)}>
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status === 'failed' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => retryUpload(item.id)}>
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status !== 'uploading' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeFromQueue(item.id)}>
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

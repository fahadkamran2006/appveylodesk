import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
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
  Download,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useDownloadContext, QueuedDownload } from '@/contexts/DownloadContext';

export function GlobalDownloadTray() {
  const {
    downloads,
    isMinimized,
    setIsMinimized,
    cancelDownload,
    retryDownload,
    removeDownload,
    clearCompleted,
    formatBytes,
    formatTimeRemaining,
  } = useDownloadContext();

  const [isExpanded, setIsExpanded] = useState(true);

  const activeCount = downloads.filter(d => d.status === 'downloading').length;
  const completedCount = downloads.filter(d => d.status === 'completed').length;
  const totalReceived = downloads.reduce((s, d) => s + d.receivedBytes, 0);
  const totalSize = downloads.reduce((s, d) => s + d.fileSize, 0);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '')) return <Video className="w-4 h-4 text-primary" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return <Image className="w-4 h-4 text-success" />;
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <FileText className="w-4 h-4 text-warning" />;
    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusIcon = (status: QueuedDownload['status']) => {
    switch (status) {
      case 'downloading': return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'cancelled': return <X className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const overallProgress = totalSize > 0 ? Math.round((totalReceived / totalSize) * 100) : 0;

  if (downloads.length === 0) return null;

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
          <Download className="w-6 h-6" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary animate-pulse" />
          )}
          <span className="absolute -bottom-1 -left-1 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center text-xs font-medium">
            {activeCount || completedCount}
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
          <Download className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium text-foreground text-sm">
              Downloads
              {activeCount > 0 && <span className="ml-2 text-xs text-primary">Downloading...</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{downloads.length} completed
              {totalSize > 0 && <> • {formatBytes(totalReceived)} / {formatBytes(totalSize)}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      <Progress value={overallProgress} className="h-1 rounded-none" />

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {/* Controls */}
            <div className="flex items-center justify-end px-4 py-2 border-b border-border/50 bg-muted/10">
              {completedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearCompleted(); }} className="h-7 text-xs text-muted-foreground">
                  Clear Done
                </Button>
              )}
            </div>

            {/* Download List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
              {downloads.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 bg-background hover:bg-muted/20 transition-colors",
                    item.status === 'downloading' && "bg-primary/5",
                    item.status === 'failed' && "bg-destructive/5",
                    item.status === 'completed' && "opacity-60",
                  )}
                >
                  <div className="shrink-0">{getFileIcon(item.fileName)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{item.fileName}</p>
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.fileSize > 0 && <span>{formatBytes(item.receivedBytes)} / {formatBytes(item.fileSize)}</span>}
                      {item.fileSize === 0 && item.receivedBytes > 0 && <span>{formatBytes(item.receivedBytes)}</span>}
                    </div>

                    {item.status === 'downloading' && (
                      <div className="mt-2 space-y-1">
                        <Progress value={item.progress} className="h-1" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{item.progress}%</span>
                          {item.speed > 0 && (
                            <span>
                              {formatBytes(item.speed)}/s • {formatTimeRemaining(item.remainingTime)} left
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {item.status === 'failed' && item.error && (
                      <p className="text-xs text-destructive mt-1 truncate">{item.error}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'downloading' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancelDownload(item.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                    {item.status === 'failed' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => retryDownload(item.id)}>
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                    {item.status !== 'downloading' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeDownload(item.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

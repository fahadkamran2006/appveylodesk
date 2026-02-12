import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isDefinitelyBunnyStreamUrl } from '@/lib/bunnyStream';

export interface QueuedDownload {
  id: string;
  fileName: string;
  fileSize: number;
  receivedBytes: number;
  status: 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  speed: number;
  remainingTime: number;
  error?: string;
  abortController: AbortController;
  // For retry
  deliverableId: string;
  fileUrl: string;
}

interface DownloadContextType {
  downloads: QueuedDownload[];
  isMinimized: boolean;
  setIsMinimized: (v: boolean) => void;
  startDownload: (deliverableId: string, fileName: string, fileUrl: string, fileSize?: number) => void;
  cancelDownload: (id: string) => void;
  retryDownload: (id: string) => void;
  removeDownload: (id: string) => void;
  clearCompleted: () => void;
  formatBytes: (bytes: number) => string;
  formatTimeRemaining: (seconds: number) => string;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

export function useDownloadContext() {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error('useDownloadContext must be used within DownloadProvider');
  return ctx;
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [downloads, setDownloads] = useState<QueuedDownload[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const speedSamplesRef = useRef<Map<string, { time: number; bytes: number }[]>>(new Map());

  const formatBytes = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  const formatTimeRemaining = useCallback((seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }, []);

  const updateDownload = useCallback((id: string, updates: Partial<QueuedDownload>) => {
    setDownloads(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const performDownload = useCallback(async (
    id: string,
    deliverableId: string,
    fileName: string,
    fileUrl: string,
    abortController: AbortController,
  ) => {
    try {
      const isBunnyStream = isDefinitelyBunnyStreamUrl(fileUrl);
      let fetchUrl: string;
      let fetchOptions: RequestInit;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (isBunnyStream) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        fetchUrl = `${supabaseUrl}/functions/v1/bunny-ops`;
        fetchOptions = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'download_stream', deliverableId }),
          signal: abortController.signal,
        };
      } else {
        fetchUrl = fileUrl;
        fetchOptions = { signal: abortController.signal };
      }

      const response = await fetch(fetchUrl, fetchOptions);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = Number(response.headers.get('Content-Length') || 0);
      if (contentLength > 0) {
        updateDownload(id, { fileSize: contentLength });
      }

      // Get filename from Content-Disposition if available
      let downloadName = fileName;
      const disposition = response.headers.get('Content-Disposition');
      if (disposition) {
        const match = disposition.match(/filename=\\\"(.+)\\\"/);
        if (match) downloadName = match[1];
      }
      if (isBunnyStream && !downloadName.toLowerCase().endsWith('.mp4')) {
        downloadName = downloadName.replace(/\\.[^.]+$/, '') + '.mp4';
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

      const chunks: Uint8Array[] = [];
      let received = 0;
      const startTime = Date.now();
      speedSamplesRef.current.set(id, []);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;

        const now = Date.now();
        const samples = speedSamplesRef.current.get(id) || [];
        samples.push({ time: now, bytes: received });
        // Keep last 10 samples for speed calc
        if (samples.length > 10) samples.shift();
        speedSamplesRef.current.set(id, samples);

        let speed = 0;
        let remainingTime = 0;
        if (samples.length >= 2) {
          const oldest = samples[0];
          const elapsed = (now - oldest.time) / 1000;
          if (elapsed > 0) {
            speed = (received - oldest.bytes) / elapsed;
            if (speed > 0 && contentLength > 0) {
              remainingTime = (contentLength - received) / speed;
            }
          }
        }

        const progress = contentLength > 0 ? Math.round((received / contentLength) * 100) : 0;
        updateDownload(id, { receivedBytes: received, progress, speed, remainingTime });
      }

      speedSamplesRef.current.delete(id);

      // Build blob and trigger browser save
      const blob = new Blob(chunks as BlobPart[]);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      updateDownload(id, { status: 'completed', progress: 100, receivedBytes: received, speed: 0, remainingTime: 0 });
    } catch (err: any) {
      speedSamplesRef.current.delete(id);
      if (err.name === 'AbortError') {
        updateDownload(id, { status: 'cancelled', speed: 0, remainingTime: 0 });
      } else {
        updateDownload(id, { status: 'failed', error: err.message || 'Download failed', speed: 0, remainingTime: 0 });
      }
    }
  }, [updateDownload]);

  const startDownload = useCallback((deliverableId: string, fileName: string, fileUrl: string, fileSize?: number) => {
    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const abortController = new AbortController();
    const item: QueuedDownload = {
      id,
      fileName,
      fileSize: fileSize || 0,
      receivedBytes: 0,
      status: 'downloading',
      progress: 0,
      speed: 0,
      remainingTime: 0,
      abortController,
      deliverableId,
      fileUrl,
    };
    setDownloads(prev => [item, ...prev]);
    performDownload(id, deliverableId, fileName, fileUrl, abortController);
  }, [performDownload]);

  const cancelDownload = useCallback((id: string) => {
    setDownloads(prev => {
      const item = prev.find(d => d.id === id);
      if (item && item.status === 'downloading') {
        item.abortController.abort();
      }
      return prev.map(d => d.id === id ? { ...d, status: 'cancelled' as const, speed: 0, remainingTime: 0 } : d);
    });
  }, []);

  const retryDownload = useCallback((id: string) => {
    setDownloads(prev => {
      const item = prev.find(d => d.id === id);
      if (!item) return prev;
      const newAbort = new AbortController();
      performDownload(id, item.deliverableId, item.fileName, item.fileUrl, newAbort);
      return prev.map(d => d.id === id ? {
        ...d,
        status: 'downloading' as const,
        progress: 0,
        receivedBytes: 0,
        speed: 0,
        remainingTime: 0,
        error: undefined,
        abortController: newAbort,
      } : d);
    });
  }, [performDownload]);

  const removeDownload = useCallback((id: string) => {
    setDownloads(prev => {
      const item = prev.find(d => d.id === id);
      if (item && item.status === 'downloading') item.abortController.abort();
      return prev.filter(d => d.id !== id);
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setDownloads(prev => prev.filter(d => d.status === 'downloading'));
  }, []);

  return (
    <DownloadContext.Provider value={{
      downloads, isMinimized, setIsMinimized,
      startDownload, cancelDownload, retryDownload, removeDownload, clearCompleted,
      formatBytes, formatTimeRemaining,
    }}>
      {children}
    </DownloadContext.Provider>
  );
}

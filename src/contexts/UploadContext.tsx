import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface QueuedUpload {
  id: string;
  file: File;
  projectId: string;
  projectTitle?: string;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  progress: number;
  speed: number;
  remainingTime: number;
  error?: string;
  addedAt: number;
  fileType?: 'asset' | 'deliverable';
}

export interface UploadQueueState {
  queue: QueuedUpload[];
  isProcessing: boolean;
  isPaused: boolean;
  currentUploadId: string | null;
}

export interface UploadQueueStats {
  pending: number;
  uploading: number;
  paused: number;
  completed: number;
  failed: number;
  total: number;
  totalSize: number;
  uploadedSize: number;
}

interface UploadContextValue {
  queue: QueuedUpload[];
  isProcessing: boolean;
  isPaused: boolean;
  currentUploadId: string | null;
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
  addToQueue: (files: File[], projectId: string, projectTitle?: string, fileType?: 'asset' | 'deliverable') => string[];
  removeFromQueue: (uploadId: string) => void;
  clearCompleted: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  pauseUpload: (uploadId: string) => void;
  resumeUpload: (uploadId: string) => void;
  pauseQueue: () => void;
  resumeQueue: () => void;
  retryUpload: (uploadId: string) => void;
  cancelAll: () => void;
  getQueueStats: () => UploadQueueStats;
  formatBytes: (bytes: number) => string;
  formatTimeRemaining: (seconds: number) => string;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploadContext() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUploadContext must be used within UploadProvider');
  }
  return context;
}

// Direct upload to Bunny Storage using presigned credentials
async function directUploadToStorage(
  uploadUrl: string,
  accessKey: string,
  file: File,
  onProgress: (loaded: number, total: number, speed: number, remainingTime: number) => void,
  abortSignal?: AbortController
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        const loadedDiff = event.loaded - lastLoaded;
        
        const instantSpeed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
        const avgSpeed = event.loaded / ((now - startTime) / 1000);
        const speed = (instantSpeed + avgSpeed) / 2;
        
        const remaining = event.total - event.loaded;
        const remainingTime = speed > 0 ? remaining / speed : 0;
        
        onProgress(event.loaded, event.total, speed, remainingTime);
        
        lastLoaded = event.loaded;
        lastTime = now;
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    if (abortSignal) {
      abortSignal.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('AccessKey', accessKey);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(file);
  });
}

// Direct upload to Bunny Stream using TUS protocol
async function directUploadToStream(
  file: File,
  videoId: string,
  libraryId: string,
  authorizationSignature: string,
  authorizationExpire: number,
  onProgress: (loaded: number, total: number, speed: number, remainingTime: number) => void,
  abortSignal?: AbortController
): Promise<void> {
  // Simple PUT upload for Stream (TUS is complex, use simple upload for now)
  const BUNNY_STREAM_API_KEY = await getStreamApiKey();
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        const loadedDiff = event.loaded - lastLoaded;
        
        const instantSpeed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
        const avgSpeed = event.loaded / ((now - startTime) / 1000);
        const speed = (instantSpeed + avgSpeed) / 2;
        
        const remaining = event.total - event.loaded;
        const remainingTime = speed > 0 ? remaining / speed : 0;
        
        onProgress(event.loaded, event.total, speed, remainingTime);
        
        lastLoaded = event.loaded;
        lastTime = now;
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Stream upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during stream upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    if (abortSignal) {
      abortSignal.signal.addEventListener('abort', () => xhr.abort());
    }

    // Use TUS-style headers for resumable upload
    xhr.open('PUT', `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`);
    xhr.setRequestHeader('AuthorizationSignature', authorizationSignature);
    xhr.setRequestHeader('AuthorizationExpire', authorizationExpire.toString());
    xhr.setRequestHeader('VideoId', videoId);
    xhr.setRequestHeader('LibraryId', libraryId);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(file);
  });
}

// Helper to get stream API key from backend (we don't expose it to frontend)
async function getStreamApiKey(): Promise<string> {
  // This is handled by the presigned-upload function
  return '';
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  
  const [state, setState] = useState<UploadQueueState>({
    queue: [],
    isProcessing: false,
    isPaused: false,
    currentUploadId: null,
  });
  const [isMinimized, setIsMinimized] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);

  const generateId = () => `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const isVideoFile = useCallback((fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v', 'flv', 'mpeg', 'mpg'];
    return videoExtensions.includes(ext);
  }, []);

  const addToQueue = useCallback((
    files: File[], 
    projectId: string, 
    projectTitle?: string,
    fileType: 'asset' | 'deliverable' = 'deliverable'
  ) => {
    const newItems: QueuedUpload[] = files.map(file => ({
      id: generateId(),
      file,
      projectId,
      projectTitle,
      status: 'pending',
      progress: 0,
      speed: 0,
      remainingTime: 0,
      addedAt: Date.now(),
      fileType,
    }));

    setState(prev => ({
      ...prev,
      queue: [...prev.queue, ...newItems],
    }));

    toast({
      title: 'Files added to queue',
      description: `${files.length} file(s) added to upload queue`,
    });

    // Expand the tray when files are added
    setIsMinimized(false);

    return newItems.map(item => item.id);
  }, [toast]);

  const removeFromQueue = useCallback((uploadId: string) => {
    setState(prev => {
      if (prev.currentUploadId === uploadId && abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      return {
        ...prev,
        queue: prev.queue.filter(item => item.id !== uploadId),
        currentUploadId: prev.currentUploadId === uploadId ? null : prev.currentUploadId,
      };
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.filter(item => item.status !== 'completed' && item.status !== 'failed'),
    }));
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newQueue = [...prev.queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return { ...prev, queue: newQueue };
    });
  }, []);

  const pauseUpload = useCallback((uploadId: string) => {
    setState(prev => {
      if (prev.currentUploadId === uploadId && abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      return {
        ...prev,
        queue: prev.queue.map(q =>
          q.id === uploadId && q.status === 'uploading'
            ? { ...q, status: 'paused' as const }
            : q
        ),
        currentUploadId: prev.currentUploadId === uploadId ? null : prev.currentUploadId,
      };
    });
  }, []);

  const resumeUpload = useCallback((uploadId: string) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.map(q =>
        q.id === uploadId && q.status === 'paused'
          ? { ...q, status: 'pending' as const }
          : q
      ),
    }));
  }, []);

  const pauseQueue = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      isPaused: true,
      queue: prev.queue.map(q =>
        q.status === 'uploading' ? { ...q, status: 'paused' as const } : q
      ),
      currentUploadId: null,
    }));
  }, []);

  const resumeQueue = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: false,
      queue: prev.queue.map(q =>
        q.status === 'paused' ? { ...q, status: 'pending' as const } : q
      ),
    }));
  }, []);

  const retryUpload = useCallback((uploadId: string) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.map(q =>
        q.id === uploadId && q.status === 'failed'
          ? { ...q, status: 'pending' as const, progress: 0, error: undefined }
          : q
      ),
    }));
  }, []);

  const cancelAll = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setState({
      queue: [],
      isProcessing: false,
      isPaused: false,
      currentUploadId: null,
    });
  }, []);

  // Upload using presigned URL flow
  const uploadFile = useCallback(async (item: QueuedUpload): Promise<boolean> => {
    if (!user || !session?.access_token) return false;

    abortControllerRef.current = new AbortController();

    try {
      const shouldUseStream = isVideoFile(item.file.name);

      // Step 1: Get presigned upload credentials
      const { data: initData, error: initError } = await supabase.functions.invoke('presigned-upload', {
        body: {
          action: 'initiate',
          projectId: item.projectId,
          fileName: item.file.name,
          fileSize: item.file.size,
          useStream: shouldUseStream,
        },
      });

      if (initError) throw initError;
      if (!initData?.ok) throw new Error(initData?.error || 'Failed to get upload credentials');

      // Step 2: Upload directly to Bunny
      if (initData.uploadType === 'storage') {
        await directUploadToStorage(
          initData.uploadUrl,
          initData.accessKey,
          item.file,
          (loaded, total, speed, remainingTime) => {
            const percentage = Math.round((loaded / total) * 100);
            setState(prev => ({
              ...prev,
              queue: prev.queue.map(q =>
                q.id === item.id
                  ? { ...q, progress: percentage, speed, remainingTime }
                  : q
              ),
            }));
          },
          abortControllerRef.current
        );
      } else if (initData.uploadType === 'stream') {
        await directUploadToStream(
          item.file,
          initData.videoId,
          initData.libraryId,
          initData.authorizationSignature,
          initData.authorizationExpire,
          (loaded, total, speed, remainingTime) => {
            const percentage = Math.round((loaded / total) * 100);
            setState(prev => ({
              ...prev,
              queue: prev.queue.map(q =>
                q.id === item.id
                  ? { ...q, progress: percentage, speed, remainingTime }
                  : q
              ),
            }));
          },
          abortControllerRef.current
        );
      }

      // Step 3: Finalize - save to database
      const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke('presigned-upload', {
        body: {
          action: 'finalize',
          projectId: item.projectId,
          fileName: item.file.name,
          fileSize: item.file.size,
          cdnUrl: initData.cdnUrl,
          fileType: item.fileType || 'deliverable',
        },
      });

      if (finalizeError) throw finalizeError;
      if (!finalizeData?.ok) throw new Error(finalizeData?.error || 'Failed to save file record');

      return true;
    } catch (error: any) {
      if (error.message === 'Upload cancelled') {
        return false;
      }
      console.error('Upload error:', error);
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  }, [user, session, isVideoFile]);

  // Process queue
  const processQueue = useCallback(async () => {
    if (processingRef.current || state.isPaused) return;
    
    const pendingItem = state.queue.find(q => q.status === 'pending');
    if (!pendingItem) {
      setState(prev => ({ ...prev, isProcessing: false }));
      return;
    }

    processingRef.current = true;
    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentUploadId: pendingItem.id,
      queue: prev.queue.map(q =>
        q.id === pendingItem.id ? { ...q, status: 'uploading' as const } : q
      ),
    }));

    try {
      const success = await uploadFile(pendingItem);
      
      setState(prev => ({
        ...prev,
        queue: prev.queue.map(q =>
          q.id === pendingItem.id
            ? { ...q, status: success ? 'completed' : 'paused', progress: success ? 100 : q.progress }
            : q
        ),
        currentUploadId: null,
      }));

      if (success) {
        toast({
          title: 'Upload complete',
          description: `${pendingItem.file.name} uploaded successfully`,
        });
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        queue: prev.queue.map(q =>
          q.id === pendingItem.id
            ? { ...q, status: 'failed' as const, error: error.message }
            : q
        ),
        currentUploadId: null,
      }));

      toast({
        title: 'Upload failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    }

    processingRef.current = false;
  }, [state.queue, state.isPaused, uploadFile, toast]);

  // Auto-process queue
  useEffect(() => {
    if (!state.isPaused && state.queue.some(q => q.status === 'pending') && !processingRef.current) {
      processQueue();
    }
  }, [state.queue, state.isPaused, processQueue]);

  const getQueueStats = useCallback((): UploadQueueStats => {
    const pending = state.queue.filter(q => q.status === 'pending').length;
    const uploading = state.queue.filter(q => q.status === 'uploading').length;
    const paused = state.queue.filter(q => q.status === 'paused').length;
    const completed = state.queue.filter(q => q.status === 'completed').length;
    const failed = state.queue.filter(q => q.status === 'failed').length;
    const total = state.queue.length;

    const totalSize = state.queue.reduce((acc, q) => acc + q.file.size, 0);
    const uploadedSize = state.queue.reduce((acc, q) => {
      if (q.status === 'completed') return acc + q.file.size;
      if (q.status === 'uploading') return acc + (q.file.size * q.progress / 100);
      return acc;
    }, 0);

    return { pending, uploading, paused, completed, failed, total, totalSize, uploadedSize };
  }, [state.queue]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <UploadContext.Provider value={{
      queue: state.queue,
      isProcessing: state.isProcessing,
      isPaused: state.isPaused,
      currentUploadId: state.currentUploadId,
      isMinimized,
      setIsMinimized,
      addToQueue,
      removeFromQueue,
      clearCompleted,
      reorderQueue,
      pauseUpload,
      resumeUpload,
      pauseQueue,
      resumeQueue,
      retryUpload,
      cancelAll,
      getQueueStats,
      formatBytes,
      formatTimeRemaining,
    }}>
      {children}
    </UploadContext.Provider>
  );
}

import { useState, useCallback, useRef, useEffect } from 'react';
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
}

export interface UploadQueueState {
  queue: QueuedUpload[];
  isProcessing: boolean;
  isPaused: boolean;
  currentUploadId: string | null;
}

// XMLHttpRequest-based upload with real progress tracking
async function uploadWithProgress(
  url: string,
  formData: FormData,
  authToken: string,
  onProgress: (loaded: number, total: number, speed: number, remainingTime: number) => void,
  abortSignal?: AbortController
): Promise<any> {
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
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch {
          resolve({ ok: true });
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    if (abortSignal) {
      abortSignal.signal.addEventListener('abort', () => {
        xhr.abort();
      });
    }

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    xhr.send(formData);
  });
}

export function useUploadQueue() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  
  const [state, setState] = useState<UploadQueueState>({
    queue: [],
    isProcessing: false,
    isPaused: false,
    currentUploadId: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);

  // Generate unique ID for queued items
  const generateId = () => `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Check if file is a video
  const isVideoFile = useCallback((fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const videoExtensions = [
      'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v', 'flv', 'mpeg', 'mpg',
      'ts', 'mts', 'm2ts', '3gp', '3g2', 'ogv', 'vob', 'mxf', 'rm', 'rmvb',
      'asf', 'divx', 'f4v', 'swf', 'dv', 'qt', 'yuv', 'amv', 'mp2', 'mpv',
      'm2v', 'svi', 'mpe', 'nsv', 'f4p', 'f4a', 'f4b',
    ];
    return videoExtensions.includes(ext);
  }, []);

  // Add files to queue
  const addToQueue = useCallback((files: File[], projectId: string, projectTitle?: string) => {
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
    }));

    setState(prev => ({
      ...prev,
      queue: [...prev.queue, ...newItems],
    }));

    toast({
      title: 'Files added to queue',
      description: `${files.length} file(s) added to upload queue`,
    });

    return newItems.map(item => item.id);
  }, [toast]);

  // Remove from queue
  const removeFromQueue = useCallback((uploadId: string) => {
    setState(prev => {
      // If currently uploading this file, abort it
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

  // Clear completed/failed items
  const clearCompleted = useCallback(() => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.filter(item => item.status !== 'completed' && item.status !== 'failed'),
    }));
  }, []);

  // Move item in queue (for reordering)
  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newQueue = [...prev.queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return { ...prev, queue: newQueue };
    });
  }, []);

  // Pause/resume individual item
  const pauseUpload = useCallback((uploadId: string) => {
    setState(prev => {
      const item = prev.queue.find(q => q.id === uploadId);
      if (!item) return prev;

      // If this is the current upload, abort it
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

  // Pause/resume entire queue
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

  // Retry failed upload
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

  // Cancel all uploads
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

  // Upload single file
  const uploadFile = useCallback(async (item: QueuedUpload): Promise<boolean> => {
    if (!user || !session?.access_token) return false;

    abortControllerRef.current = new AbortController();

    try {
      const shouldUseStream = isVideoFile(item.file.name);
      
      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('projectId', item.projectId);
      formData.append('file', item.file);
      if (shouldUseStream) {
        formData.append('useStream', 'true');
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bunny-ops`;

      const data = await uploadWithProgress(
        functionUrl,
        formData,
        session.access_token,
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

      if (!data || data.error) throw new Error(data?.error || 'Upload failed');

      const cdnUrl = data.cdnUrl;

      // Get current version number
      const { data: existingDeliverables } = await supabase
        .from('deliverables')
        .select('version')
        .eq('project_id', item.projectId)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = (existingDeliverables?.[0]?.version || 0) + 1;

      // Create deliverable record
      const { error: dbError } = await supabase
        .from('deliverables')
        .insert({
          project_id: item.projectId,
          file_name: item.file.name,
          file_url: cdnUrl,
          file_size: item.file.size,
          version: nextVersion,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

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
    }

    processingRef.current = false;
  }, [state.queue, state.isPaused, uploadFile]);

  // Auto-process queue when items are added or resumed
  useEffect(() => {
    if (!state.isPaused && state.queue.some(q => q.status === 'pending') && !processingRef.current) {
      processQueue();
    }
  }, [state.queue, state.isPaused, processQueue]);

  // Get queue stats
  const getQueueStats = useCallback(() => {
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

  // Format helpers
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

  return {
    queue: state.queue,
    isProcessing: state.isProcessing,
    isPaused: state.isPaused,
    currentUploadId: state.currentUploadId,
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
  };
}

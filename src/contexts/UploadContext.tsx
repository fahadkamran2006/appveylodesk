import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { createTusUpload, TusUploadController } from '@/lib/tusUploader';

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
  // TUS-specific fields for resume capability
  tusController?: TusUploadController;
  videoId?: string;
  cdnUrl?: string;
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
  addToQueue: (files: File[], projectId: string, projectTitle?: string, fileType?: 'asset' | 'deliverable') => Promise<string[]>;
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

// Proxy upload through edge function (never exposes CDN key)
async function proxyUploadToStorage(
  storagePath: string,
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
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.ok) resolve();
          else reject(new Error(resp.error || 'Upload failed'));
        } catch {
          resolve(); // If response isn't JSON but status is OK
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    if (abortSignal) {
      abortSignal.signal.addEventListener('abort', () => xhr.abort());
    }

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/presigned-upload`;

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-storage-path', storagePath);
    xhr.setRequestHeader('x-upload-action', 'upload');
    // Pass auth token
    const session = JSON.parse(localStorage.getItem('sb-' + projectId + '-auth-token') || '{}');
    const token = session?.access_token;
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
    xhr.send(file);
  });
}

// TUS-based upload to Bunny Stream with resume capability
function tusUploadToStream(
  file: File,
  videoId: string,
  libraryId: string,
  authorizationSignature: string,
  authorizationExpire: number,
  onProgress: (loaded: number, total: number, speed: number, remainingTime: number) => void,
): Promise<{ controller: TusUploadController; promise: Promise<void> }> {
  return new Promise((resolve) => {
    let resolveUpload: () => void;
    let rejectUpload: (error: Error) => void;
    
    const uploadPromise = new Promise<void>((res, rej) => {
      resolveUpload = res;
      rejectUpload = rej;
    });

    const controller = createTusUpload({
      file,
      videoId,
      libraryId,
      authorizationSignature,
      authorizationExpire,
      onProgress,
      onSuccess: () => resolveUpload(),
      onError: (error) => rejectUpload(error),
    });

    // Start the upload immediately
    controller.start();
    
    resolve({ controller, promise: uploadPromise });
  });
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
  const tusControllerRef = useRef<TusUploadController | null>(null);
  const processingRef = useRef(false);

  const generateId = () => `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const isVideoFile = useCallback((fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const videoExtensions = [
      'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v', 'flv', 'mpeg', 'mpg',
      'ts', 'mts', 'm2ts', '3gp', '3g2', 'ogv', 'vob', 'mxf', 'rm', 'rmvb',
      'asf', 'divx', 'f4v', 'swf', 'dv', 'qt', 'yuv', 'amv', 'mp2', 'mpv',
      'm2v', 'svi', 'mpe', 'nsv', 'flv', 'f4v', 'f4p', 'f4a', 'f4b',
    ];
    return videoExtensions.includes(ext);
  }, []);

  const addToQueue = useCallback(async (
    files: File[], 
    projectId: string, 
    projectTitle?: string,
    fileType: 'asset' | 'deliverable' = 'deliverable'
  ) => {
    // Check storage limit before adding files
    if (user) {
      try {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('agency_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userRole?.agency_id) {
          const { data: agency } = await supabase
            .from('agencies')
            .select('storage_limit_bytes, storage_used_bytes')
            .eq('id', userRole.agency_id)
            .single();

          if (agency) {
            const totalUploadSize = files.reduce((sum, f) => sum + f.size, 0);
            const remainingStorage = agency.storage_limit_bytes - agency.storage_used_bytes;

            if (totalUploadSize > remainingStorage) {
              const formatBytes = (bytes: number) => {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
              };

              toast({
                title: 'Storage limit exceeded',
                description: `You need ${formatBytes(totalUploadSize)} but only have ${formatBytes(remainingStorage)} remaining. Please upgrade your plan for more storage.`,
                variant: 'destructive',
              });
              return [];
            }
          }
        }
      } catch (error) {
        console.error('Error checking storage limit:', error);
        // Continue with upload even if check fails
      }
    }

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
  }, [toast, user]);

  // Cleanup orphaned Bunny Stream video when upload is cancelled/removed
  const cleanupOrphanedVideo = useCallback(async (videoId: string) => {
    try {
      console.log(`Cleaning up orphaned Bunny Stream video: ${videoId}`);
      await supabase.functions.invoke('presigned-upload', {
        body: { action: 'cleanup', videoId },
      });
    } catch (err) {
      console.error('Failed to cleanup orphaned video:', err);
    }
  }, []);

  const removeFromQueue = useCallback((uploadId: string) => {
    setState(prev => {
      const item = prev.queue.find(q => q.id === uploadId);
      
      if (prev.currentUploadId === uploadId && abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // If item had a videoId but wasn't completed, clean up the orphaned video
      if (item?.videoId && item.status !== 'completed') {
        cleanupOrphanedVideo(item.videoId);
      }
      
      // Abort TUS controller if active
      if (item?.tusController) {
        item.tusController.abort();
      }
      
      return {
        ...prev,
        queue: prev.queue.filter(q => q.id !== uploadId),
        currentUploadId: prev.currentUploadId === uploadId ? null : prev.currentUploadId,
      };
    });
  }, [cleanupOrphanedVideo]);

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
      const item = prev.queue.find(q => q.id === uploadId);
      
      // Handle TUS upload pause
      if (item?.tusController) {
        item.tusController.pause();
      }
      
      // Handle regular upload pause
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
    setState(prev => {
      const item = prev.queue.find(q => q.id === uploadId);
      
      // If this is a TUS upload with a controller, resume it
      if (item?.tusController && item.videoId) {
        item.tusController.resume();
        return {
          ...prev,
          queue: prev.queue.map(q =>
            q.id === uploadId && q.status === 'paused'
              ? { ...q, status: 'uploading' as const }
              : q
          ),
          currentUploadId: uploadId,
        };
      }
      
      // For regular uploads, mark as pending to restart
      return {
        ...prev,
        queue: prev.queue.map(q =>
          q.id === uploadId && q.status === 'paused'
            ? { ...q, status: 'pending' as const }
            : q
        ),
      };
    });
  }, []);

  const pauseQueue = useCallback(() => {
    // Pause TUS controller if active
    if (tusControllerRef.current) {
      tusControllerRef.current.pause();
    }
    
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
    // Abort TUS upload if active
    if (tusControllerRef.current) {
      tusControllerRef.current.abort();
      tusControllerRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Clean up orphaned videos and abort all queued TUS uploads
    setState(prev => {
      prev.queue.forEach(q => {
        if (q.tusController) {
          q.tusController.abort();
        }
        // Cleanup orphaned videos for non-completed uploads
        if (q.videoId && q.status !== 'completed') {
          cleanupOrphanedVideo(q.videoId);
        }
      });
      return {
        queue: [],
        isProcessing: false,
        isPaused: false,
        currentUploadId: null,
      };
    });
  }, [cleanupOrphanedVideo]);

  // Upload using presigned URL flow
  const uploadFile = useCallback(async (item: QueuedUpload): Promise<boolean> => {
    if (!user || !session?.access_token) return false;

    abortControllerRef.current = new AbortController();
    let streamVideoId: string | null = null;

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

      // Track videoId for cleanup on failure
      if (initData.videoId) {
        streamVideoId = initData.videoId;
        // Also store on the queue item immediately
        setState(prev => ({
          ...prev,
          queue: prev.queue.map(q =>
            q.id === item.id ? { ...q, videoId: initData.videoId, cdnUrl: initData.cdnUrl } : q
          ),
        }));
      }

      // Step 2: Upload directly to Bunny
      if (initData.uploadType === 'storage') {
        await proxyUploadToStorage(
          initData.storagePath,
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
        // Use TUS resumable upload for videos
        const { controller, promise } = await tusUploadToStream(
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
                  ? { 
                      ...q, 
                      progress: percentage, 
                      speed, 
                      remainingTime,
                      tusController: controller,
                      videoId: initData.videoId,
                      cdnUrl: initData.cdnUrl,
                    }
                  : q
              ),
            }));
          },
        );
        
        // Store the controller for pause/resume
        tusControllerRef.current = controller;
        
        // Wait for upload to complete
        await promise;
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

      streamVideoId = null; // Upload succeeded, don't clean up
      return true;
    } catch (error: any) {
      // Clean up orphaned Bunny Stream video on failure
      if (streamVideoId) {
        cleanupOrphanedVideo(streamVideoId);
      }
      if (error.message === 'Upload cancelled') {
        return false;
      }
      console.error('Upload error:', error);
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  }, [user, session, isVideoFile, cleanupOrphanedVideo]);

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
      
      setState(prev => {
        const updatedQueue = prev.queue.map(q => {
          if (q.id !== pendingItem.id) return q;
          const newStatus: QueuedUpload['status'] = success ? 'completed' : 'paused';
          return { ...q, status: newStatus, progress: success ? 100 : q.progress };
        });
        const hasMorePending = updatedQueue.some(q => q.status === 'pending');
        return {
          ...prev,
          queue: updatedQueue,
          currentUploadId: null,
          isProcessing: hasMorePending,
        };
      });

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

  // Warn users before leaving with active uploads & clean up orphaned videos
  useEffect(() => {
    const hasActiveUploads = state.queue.some(q => q.status === 'uploading' || q.status === 'pending');
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasActiveUploads) {
        e.preventDefault();
        // Clean up orphaned videos for in-progress stream uploads
        state.queue.forEach(q => {
          if (q.videoId && q.status !== 'completed') {
            // Use sendBeacon for reliability during page unload
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/presigned-upload`;
            navigator.sendBeacon(url, JSON.stringify({ action: 'cleanup', videoId: q.videoId }));
          }
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.queue]);

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

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface StorageInfo {
  subscriptionPlan: 'starter' | 'pro';
  storageLimitBytes: number;
  storageUsedBytes: number;
  storageUsedPercentage: number;
}

export interface Deliverable {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  version: number | null;
  uploaded_by: string;
  created_at: string;
  uploader_name?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

const PLAN_LIMITS = {
  starter: 200 * 1024 * 1024 * 1024, // 200 GB
  pro: 1024 * 1024 * 1024 * 1024, // 1 TB
};

// XMLHttpRequest-based upload with real progress tracking
async function uploadWithProgress(
  url: string,
  formData: FormData,
  authToken: string,
  onProgress: (progress: UploadProgress) => void,
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
        const timeDiff = (now - lastTime) / 1000; // seconds
        const loadedDiff = event.loaded - lastLoaded;
        
        // Calculate speed (bytes per second) with smoothing
        const instantSpeed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
        const avgSpeed = event.loaded / ((now - startTime) / 1000);
        const speed = (instantSpeed + avgSpeed) / 2;
        
        // Calculate remaining time
        const remaining = event.total - event.loaded;
        const remainingTime = speed > 0 ? remaining / speed : 0;
        
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
          speed,
          remainingTime,
        });
        
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

export function useStorage() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch agency storage info
  const fetchStorageInfo = useCallback(async () => {
    if (!user) return null;

    try {
      // Get user's agency
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!roleData?.agency_id) return null;

      const { data: agency, error } = await supabase
        .from('agencies')
        .select('subscription_plan, storage_limit_bytes, storage_used_bytes')
        .eq('id', roleData.agency_id)
        .single();

      if (error) throw error;

      const info: StorageInfo = {
        subscriptionPlan: agency.subscription_plan as 'starter' | 'pro',
        storageLimitBytes: agency.storage_limit_bytes,
        storageUsedBytes: agency.storage_used_bytes,
        storageUsedPercentage: (agency.storage_used_bytes / agency.storage_limit_bytes) * 100,
      };

      setStorageInfo(info);
      return info;
    } catch (error) {
      console.error('Error fetching storage info:', error);
      return null;
    }
  }, [user]);

  // Check if upload is allowed
  const checkStorageLimit = useCallback(async (fileSize: number): Promise<boolean> => {
    const info = await fetchStorageInfo();
    if (!info) {
      toast({
        title: 'Error',
        description: 'Could not verify storage limit',
        variant: 'destructive',
      });
      return false;
    }

    if (info.storageUsedBytes + fileSize > info.storageLimitBytes) {
      toast({
        title: 'Storage Full',
        description: `Your ${info.subscriptionPlan === 'starter' ? 'Starter' : 'Pro'} plan has reached its storage limit. Please upgrade or delete some files.`,
        variant: 'destructive',
      });
      return false;
    }

    return true;
  }, [fetchStorageInfo, toast]);

  // Check if file is a video that should use Bunny Stream
  const isVideoFile = useCallback((fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v', 'flv', 'mpeg', 'mpg'];
    return videoExtensions.includes(ext);
  }, []);

  // Cancel ongoing upload
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setUploadProgress(null);
      setLoading(false);
    }
  }, []);

  // Upload deliverable file to Bunny.net CDN or Bunny Stream with real progress
  const uploadDeliverable = useCallback(async (
    projectId: string,
    file: File,
    onProgress?: (progress: number) => void,
    useStream?: boolean
  ): Promise<Deliverable | null> => {
    if (!user || !session?.access_token) return null;

    setLoading(true);
    setUploadProgress(null);
    abortControllerRef.current = new AbortController();

    try {
      // Check storage limit first
      const canUpload = await checkStorageLimit(file.size);
      if (!canUpload) {
        setLoading(false);
        return null;
      }

      // Determine if we should use Bunny Stream (for videos)
      const shouldUseStream = useStream !== false && isVideoFile(file.name);

      // Prepare FormData
      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('projectId', projectId);
      formData.append('file', file);
      if (shouldUseStream) {
        formData.append('useStream', 'true');
      }

      // Build edge function URL
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bunny-ops`;

      // Upload with real progress tracking
      let data: any;
      try {
        data = await uploadWithProgress(
          functionUrl,
          formData,
          session.access_token,
          (progress) => {
            setUploadProgress(progress);
            // Report percentage to callback (0-90% for upload, 90-100% for DB save)
            onProgress?.(Math.round(progress.percentage * 0.9));
          },
          abortControllerRef.current
        );
      } catch (uploadError: any) {
        // Extract specific error message from bunny-ops response
        const errorMessage = uploadError.message || 'Upload failed';
        console.error('Bunny upload error:', errorMessage);
        throw new Error(`Bunny Upload Failed: ${errorMessage}`);
      }

      // CRITICAL: Validate bunny-ops response BEFORE creating DB record
      if (!data) {
        throw new Error('Bunny Upload Failed: No response from storage service');
      }
      
      if (data.error) {
        throw new Error(`Bunny Upload Failed: ${data.error}`);
      }
      
      if (!data.cdnUrl) {
        throw new Error('Bunny Upload Failed: No CDN URL returned');
      }

      onProgress?.(92);

      const cdnUrl = data.cdnUrl;
      const isStream = data.isStream === true;

      // Get current version number
      const { data: existingDeliverables } = await supabase
        .from('deliverables')
        .select('version')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = (existingDeliverables?.[0]?.version || 0) + 1;

      onProgress?.(95);

      // Create deliverable record with Bunny CDN/Stream URL
      // This only runs if bunny-ops returned successfully
      const { data: deliverable, error: dbError } = await supabase
        .from('deliverables')
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_url: cdnUrl,
          file_size: file.size,
          version: nextVersion,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      onProgress?.(100);
      setUploadProgress(null);

      toast({
        title: isStream ? 'Video uploaded for processing' : 'File uploaded',
        description: isStream 
          ? `${file.name} is being processed for adaptive streaming` 
          : `${file.name} has been uploaded successfully`,
      });

      // Refresh storage info
      await fetchStorageInfo();

      return deliverable;
    } catch (error: any) {
      console.error('Error uploading deliverable:', error);
      if (error.message !== 'Upload cancelled') {
        toast({
          title: 'Upload failed',
          description: error.message || 'Please try again',
          variant: 'destructive',
        });
      }
      return null;
    } finally {
      setLoading(false);
      setUploadProgress(null);
      abortControllerRef.current = null;
    }
  }, [user, session, checkStorageLimit, fetchStorageInfo, toast, isVideoFile]);

  // Fetch deliverables for a project
  const fetchDeliverables = useCallback(async (projectId: string): Promise<Deliverable[]> => {
    try {
      const { data: deliverables, error } = await supabase
        .from('deliverables')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get uploader names
      const uploaderIds = [...new Set(deliverables?.map(d => d.uploaded_by) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', uploaderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name || p.email]) || []);

      return (deliverables || []).map(d => ({
        ...d,
        uploader_name: profileMap.get(d.uploaded_by) || 'Unknown',
      }));
    } catch (error) {
      console.error('Error fetching deliverables:', error);
      return [];
    }
  }, []);

  const invokeDeliverablesOps = useCallback(async (payload: any) => {
    const { data, error } = await supabase.functions.invoke('deliverables-ops', {
      body: payload,
    });

    if (error) throw error;
    if (!data) throw new Error('No response from backend');
    if ((data as any).error) throw new Error((data as any).error);

    return data as any;
  }, []);

  const getDeliverableSignedUrl = useCallback(async (deliverableId: string, expiresIn = 3600) => {
    try {
      const data = await invokeDeliverablesOps({
        action: 'signed_url',
        deliverableId,
        expiresIn,
      });
      return (data as any).signedUrl ?? null;
    } catch (error) {
      console.error('Error getting deliverable signed URL:', error);
      return null;
    }
  }, [invokeDeliverablesOps]);

  // Delete deliverable (Bunny CDN + DB)
  const deleteDeliverable = useCallback(async (deliverable: Deliverable): Promise<boolean> => {
    try {
      // Use bunny-ops for Bunny CDN files, fallback to deliverables-ops for legacy Supabase files
      const isBunnyCdn = deliverable.file_url.includes('b-cdn.net') || deliverable.file_url.includes('bunnycdn');
      
      if (isBunnyCdn) {
        const { data, error } = await supabase.functions.invoke('bunny-ops', {
          body: { action: 'delete', deliverableId: deliverable.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        // Legacy: use deliverables-ops for old Supabase storage files
        await invokeDeliverablesOps({
          action: 'delete',
          deliverableId: deliverable.id,
        });
      }

      toast({
        title: 'File deleted',
        description: `${deliverable.file_name} has been removed`,
      });

      // Refresh storage info
      await fetchStorageInfo();

      return true;
    } catch (error: any) {
      console.error('Error deleting deliverable:', error);
      toast({
        title: 'Delete failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchStorageInfo, toast, invokeDeliverablesOps]);

  // Rename deliverable (DB)
  const renameDeliverable = useCallback(async (
    deliverableId: string,
    newName: string
  ): Promise<boolean> => {
    try {
      await invokeDeliverablesOps({
        action: 'rename',
        deliverableId,
        newName,
      });

      toast({
        title: 'File renamed',
        description: `File has been renamed to ${newName}`,
      });

      return true;
    } catch (error: any) {
      console.error('Error renaming deliverable:', error);
      toast({
        title: 'Rename failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, invokeDeliverablesOps]);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return {
    loading,
    storageInfo,
    uploadProgress,
    fetchStorageInfo,
    checkStorageLimit,
    uploadDeliverable,
    cancelUpload,
    fetchDeliverables,
    deleteDeliverable,
    renameDeliverable,
    getDeliverableSignedUrl,
    formatBytes,
    formatTimeRemaining,
    PLAN_LIMITS,
  };
}

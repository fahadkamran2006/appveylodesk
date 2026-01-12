import { useState, useCallback } from 'react';
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

const PLAN_LIMITS = {
  starter: 200 * 1024 * 1024 * 1024, // 200 GB
  pro: 1024 * 1024 * 1024 * 1024, // 1 TB
};

export function useStorage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

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

  // Upload deliverable file
  const uploadDeliverable = useCallback(async (
    projectId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Deliverable | null> => {
    if (!user) return null;

    setLoading(true);
    try {
      // Check storage limit first
      const canUpload = await checkStorageLimit(file.size);
      if (!canUpload) {
        setLoading(false);
        return null;
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${projectId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('deliverables')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('deliverables')
        .getPublicUrl(filePath);

      // Get current version number
      const { data: existingDeliverables } = await supabase
        .from('deliverables')
        .select('version')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = (existingDeliverables?.[0]?.version || 0) + 1;

      // Create deliverable record
      const { data: deliverable, error: dbError } = await supabase
        .from('deliverables')
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          version: nextVersion,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully`,
      });

      // Refresh storage info
      await fetchStorageInfo();

      return deliverable;
    } catch (error: any) {
      console.error('Error uploading deliverable:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, checkStorageLimit, fetchStorageInfo, toast]);

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

  // Delete deliverable
  const deleteDeliverable = useCallback(async (deliverable: Deliverable): Promise<boolean> => {
    try {
      // Extract file path from URL
      const urlParts = deliverable.file_url.split('/deliverables/');
      if (urlParts.length < 2) throw new Error('Invalid file URL');
      
      const filePath = decodeURIComponent(urlParts[1]);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('deliverables')
        .remove([filePath]);

      if (storageError) {
        console.warn('Storage delete error (file may not exist):', storageError);
        // Continue to delete from database even if storage delete fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('deliverables')
        .delete()
        .eq('id', deliverable.id);

      if (dbError) throw dbError;

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
  }, [fetchStorageInfo, toast]);

  // Rename deliverable
  const renameDeliverable = useCallback(async (
    deliverableId: string,
    newName: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('deliverables')
        .update({ file_name: newName })
        .eq('id', deliverableId);

      if (error) throw error;

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
  }, [toast]);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return {
    loading,
    storageInfo,
    fetchStorageInfo,
    checkStorageLimit,
    uploadDeliverable,
    fetchDeliverables,
    deleteDeliverable,
    renameDeliverable,
    formatBytes,
    PLAN_LIMITS,
  };
}

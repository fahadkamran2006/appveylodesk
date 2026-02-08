import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AgencyLimits {
  maxClients: number;
  currentClients: number;
  storageLimitBytes: number;
  storageUsedBytes: number;
  planTier: string | null;
  isActive: boolean;
  loading: boolean;
}

export function useAgencyLimits() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<AgencyLimits>({
    maxClients: 5,
    currentClients: 0,
    storageLimitBytes: 214748364800, // 200 GB default
    storageUsedBytes: 0,
    planTier: null,
    isActive: false,
    loading: true,
  });

  const fetchLimits = useCallback(async () => {
    if (!user) {
      setLimits(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // Get user's agency
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole?.agency_id) {
        setLimits(prev => ({ ...prev, loading: false }));
        return;
      }

      const agencyId = userRole.agency_id;

      // Get agency details
      const { data: agency } = await supabase
        .from('agencies')
        .select('max_clients, storage_limit_bytes, storage_used_bytes, plan_tier, subscription_ends_at')
        .eq('id', agencyId)
        .single();

      if (!agency) {
        setLimits(prev => ({ ...prev, loading: false }));
        return;
      }

      // Count current clients
      const { count: clientCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('role', 'client');

      // Check if subscription is active
      const now = new Date();
      const endsAt = agency.subscription_ends_at ? new Date(agency.subscription_ends_at) : null;
      const isActive = endsAt !== null && endsAt > now;

      setLimits({
        maxClients: agency.max_clients || 5,
        currentClients: clientCount || 0,
        storageLimitBytes: agency.storage_limit_bytes || 214748364800,
        storageUsedBytes: agency.storage_used_bytes || 0,
        planTier: agency.plan_tier,
        isActive,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching agency limits:', error);
      setLimits(prev => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const canAddClient = useCallback(() => {
    // Scale plan has unlimited clients
    if (limits.planTier === 'scale') return true;
    return limits.currentClients < limits.maxClients;
  }, [limits]);

  const canUploadBytes = useCallback((fileSize: number) => {
    return (limits.storageUsedBytes + fileSize) <= limits.storageLimitBytes;
  }, [limits]);

  const getRemainingStorage = useCallback(() => {
    return limits.storageLimitBytes - limits.storageUsedBytes;
  }, [limits]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStoragePercentage = useCallback(() => {
    if (limits.storageLimitBytes === 0) return 0;
    return Math.round((limits.storageUsedBytes / limits.storageLimitBytes) * 100);
  }, [limits]);

  return {
    ...limits,
    canAddClient,
    canUploadBytes,
    getRemainingStorage,
    getStoragePercentage,
    formatBytes,
    refetch: fetchLimits,
  };
}

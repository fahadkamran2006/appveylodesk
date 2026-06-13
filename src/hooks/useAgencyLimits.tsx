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
  isFree: boolean;
  activeProjectCount: number;
  agencyId: string | null;
  loading: boolean;
}

const ACTIVE_PROJECT_STATUSES = ['backlog', 'in_progress', 'quality_check', 'review'] as const;

export function useAgencyLimits() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<AgencyLimits>({
    maxClients: 1,
    currentClients: 0,
    storageLimitBytes: 2147483648,
    storageUsedBytes: 0,
    planTier: null,
    isActive: false,
    isFree: false,
    activeProjectCount: 0,
    agencyId: null,
    loading: true,
  });

  const fetchLimits = useCallback(async () => {
    if (!user) {
      setLimits(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
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

      const { data: agency } = await supabase
        .from('agencies')
        .select('max_clients, storage_limit_bytes, storage_used_bytes, plan_tier, subscription_ends_at')
        .eq('id', agencyId)
        .single();

      if (!agency) {
        setLimits(prev => ({ ...prev, loading: false }));
        return;
      }

      const { count: clientCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('role', 'client');

      const { count: activeProjectCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .in('status', ACTIVE_PROJECT_STATUSES);

      const now = new Date();
      const endsAt = agency.subscription_ends_at ? new Date(agency.subscription_ends_at) : null;
      const isFree = agency.plan_tier === 'free';
      const isActive = isFree || (endsAt !== null && endsAt > now);

      setLimits({
        maxClients: agency.max_clients ?? 1,
        currentClients: clientCount || 0,
        storageLimitBytes: agency.storage_limit_bytes ?? 2147483648,
        storageUsedBytes: agency.storage_used_bytes || 0,
        planTier: agency.plan_tier,
        isActive,
        isFree,
        activeProjectCount: activeProjectCount || 0,
        agencyId,
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
    if (limits.planTier === 'scale') return true;
    return limits.currentClients < limits.maxClients;
  }, [limits]);

  const canCreateProject = useCallback(() => {
    if (!limits.isFree) return true;
    return limits.activeProjectCount < 1;
  }, [limits]);

  const canUploadBytes = useCallback((fileSize: number) => {
    return (limits.storageUsedBytes + fileSize) <= limits.storageLimitBytes;
  }, [limits]);

  const getRemainingStorage = useCallback(() => limits.storageLimitBytes - limits.storageUsedBytes, [limits]);

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
    canCreateProject,
    canUploadBytes,
    getRemainingStorage,
    getStoragePercentage,
    formatBytes,
    refetch: fetchLimits,
  };
}

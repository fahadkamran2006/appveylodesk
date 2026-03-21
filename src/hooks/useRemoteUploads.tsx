import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RemoteUploadIndicator {
  id: string;
  projectId: string;
  fileName: string;
  uploaderName: string;
  uploaderId: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
  timestamp: number;
}

/**
 * Subscribe to real-time upload activity for a given project.
 * Other users' uploads appear as ghost cards in the file list.
 */
export function useRemoteUploads(projectId: string | null) {
  const { user } = useAuth();
  const [remoteUploads, setRemoteUploads] = useState<RemoteUploadIndicator[]>([]);

  useEffect(() => {
    if (!projectId || !user) return;

    const channel = supabase.channel(`upload-activity:${projectId}`)
      .on('broadcast', { event: 'upload-progress' }, ({ payload }) => {
        // Ignore own uploads
        if (payload.uploaderId === user.id) return;

        setRemoteUploads(prev => {
          const existing = prev.findIndex(u => u.id === payload.id);
          
          if (payload.status === 'completed' || payload.status === 'failed') {
            // Remove after a short delay to show completion
            setTimeout(() => {
              setRemoteUploads(p => p.filter(u => u.id !== payload.id));
            }, 3000);
          }

          const item: RemoteUploadIndicator = {
            id: payload.id,
            projectId: payload.projectId,
            fileName: payload.fileName,
            uploaderName: payload.uploaderName,
            uploaderId: payload.uploaderId,
            progress: payload.progress,
            status: payload.status,
            timestamp: Date.now(),
          };

          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = item;
            return updated;
          }
          return [...prev, item];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, user?.id]);

  // Clean up stale indicators (older than 60s with no update)
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 60000;
      setRemoteUploads(prev => prev.filter(u => u.timestamp > cutoff));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return remoteUploads;
}

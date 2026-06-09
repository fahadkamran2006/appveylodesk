import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadProgress {
  uploading: boolean;
  progress: number;
  fileName?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function getAttachmentType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

export function useChatAttachments() {
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
  });

  const uploadChatAttachment = async (
    file: File,
    channelId: string
  ): Promise<{ url: string; type: string } | null> => {
    if (!file) return null;

    // Check file size (max 5MB)
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large for Chat',
        description: "File too large for Chat. Please upload directly to the 'Project Files' tab.",
        variant: 'destructive',
      });
      return null;
    }

    try {
      setUploadProgress({ uploading: true, progress: 10, fileName: file.name });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const ext = file.name.split('.').pop() || 'bin';
      const filePath = `${channelId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      setUploadProgress(prev => ({ ...prev, progress: 30 }));

      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      setUploadProgress(prev => ({ ...prev, progress: 80 }));

      // Bucket is private; create a long-lived signed URL (1 year)
      const { data: signed, error: signErr } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(data.path, 60 * 60 * 24 * 365);

      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('Failed to sign URL');

      setUploadProgress({ uploading: false, progress: 100, fileName: file.name });

      return {
        url: signed.signedUrl,
        type: getAttachmentType(file.type),
      };
    } catch (error: any) {
      console.error('Chat attachment upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload attachment.',
        variant: 'destructive',
      });
      setUploadProgress({ uploading: false, progress: 0 });
      return null;
    }
  };

  const cancelUpload = () => {
    setUploadProgress({ uploading: false, progress: 0 });
  };

  return {
    uploadChatAttachment,
    uploadProgress,
    cancelUpload,
  };
}

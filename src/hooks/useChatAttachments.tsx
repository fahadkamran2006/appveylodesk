import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadProgress {
  uploading: boolean;
  progress: number;
  fileName?: string;
}

export function useChatAttachments() {
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const uploadChatAttachment = async (
    file: File,
    channelId: string
  ): Promise<{ url: string; type: string } | null> => {
    if (!file) return null;

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast({
        title: 'Invalid file type',
        description: 'Only images and videos are allowed.',
        variant: 'destructive',
      });
      return null;
    }

    // Check file size (max 50MB for videos, 10MB for images)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${isVideo ? '50MB' : '10MB'}.`,
        variant: 'destructive',
      });
      return null;
    }

    try {
      setUploadProgress({ uploading: true, progress: 0, fileName: file.name });

      // Create FormData for bunny-ops upload
      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('projectId', `chat-${channelId}`); // Use channel ID as "project" for storage path
      formData.append('file', file);
      formData.append('useStream', 'false'); // Don't use stream for chat attachments

      abortControllerRef.current = new AbortController();

      // Upload using XMLHttpRequest for progress tracking
      const result = await new Promise<{ cdnUrl: string } | null>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress((prev) => ({ ...prev, progress }));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.ok && response.cdnUrl) {
                resolve({ cdnUrl: response.cdnUrl });
              } else {
                reject(new Error(response.error || 'Upload failed'));
              }
            } catch {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.error || `Upload failed: ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        // Get auth token
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session?.access_token) {
            reject(new Error('Not authenticated'));
            return;
          }

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          xhr.open('POST', `${supabaseUrl}/functions/v1/bunny-ops`);
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
          xhr.send(formData);
        });
      });

      if (!result?.cdnUrl) {
        throw new Error('No URL returned from upload');
      }

      setUploadProgress({ uploading: false, progress: 100, fileName: file.name });

      return {
        url: result.cdnUrl,
        type: isImage ? 'image' : 'video',
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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploadProgress({ uploading: false, progress: 0 });
  };

  return {
    uploadChatAttachment,
    uploadProgress,
    cancelUpload,
  };
}

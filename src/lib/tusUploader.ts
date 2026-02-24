import * as tus from 'tus-js-client';

export interface TusUploadOptions {
  file: File;
  videoId: string;
  libraryId: string;
  authorizationSignature: string;
  authorizationExpire: number;
  onProgress: (bytesUploaded: number, bytesTotal: number, speed: number, remainingTime: number) => void;
  onSuccess: () => void;
  onError: (error: Error) => void;
}

export interface TusUploadController {
  start: () => void;
  pause: () => void;
  resume: () => void;
  abort: () => void;
}

// Local storage key prefix for storing upload progress
const UPLOAD_STORAGE_PREFIX = 'tus-upload-';

// Calculate a fingerprint for resume capability
function calculateFingerprint(file: File, videoId: string): string {
  return `${file.name}-${file.size}-${file.lastModified}-${videoId}`;
}

// Store upload URL for resume
function storeUploadUrl(fingerprint: string, uploadUrl: string): void {
  try {
    localStorage.setItem(`${UPLOAD_STORAGE_PREFIX}${fingerprint}`, uploadUrl);
  } catch (e) {
    console.warn('Failed to store upload URL:', e);
  }
}

// Retrieve stored upload URL
function getStoredUploadUrl(fingerprint: string): string | null {
  try {
    return localStorage.getItem(`${UPLOAD_STORAGE_PREFIX}${fingerprint}`);
  } catch (e) {
    return null;
  }
}

// Clear stored upload URL
function clearStoredUploadUrl(fingerprint: string): void {
  try {
    localStorage.removeItem(`${UPLOAD_STORAGE_PREFIX}${fingerprint}`);
  } catch (e) {
    console.warn('Failed to clear upload URL:', e);
  }
}

/**
 * Creates a TUS resumable upload for Bunny Stream
 * 
 * The TUS protocol allows:
 * - Resuming interrupted uploads from where they left off
 * - Automatic retry on connection failures
 * - Chunked uploads for large files
 */
export function createTusUpload(options: TusUploadOptions): TusUploadController {
  const {
    file,
    videoId,
    libraryId,
    authorizationSignature,
    authorizationExpire,
    onProgress,
    onSuccess,
    onError,
  } = options;

  const fingerprint = calculateFingerprint(file, videoId);
  const startTime = Date.now();
  let lastBytesUploaded = 0;
  let lastTime = startTime;
  let uploadInstance: tus.Upload | null = null;

  // Create the TUS upload instance
  const upload = new tus.Upload(file, {
    endpoint: 'https://video.bunnycdn.com/tusupload',
    retryDelays: [0, 1000, 3000, 5000, 10000], // Retry delays in ms
    chunkSize: 5 * 1024 * 1024, // 5MB chunks for reliable uploads
    parallelUploads: 1, // Sequential for better reliability
    
    // Bunny Stream TUS headers
    headers: {
      'AuthorizationSignature': authorizationSignature,
      'AuthorizationExpire': authorizationExpire.toString(),
      'VideoId': videoId,
      'LibraryId': libraryId,
    },
    
    // Metadata for the video
    metadata: {
      filetype: file.type,
      title: file.name,
    },
    
    // Store URL for resume capability
    storeFingerprintForResuming: true,
    removeFingerprintOnSuccess: true,
    
    // Custom URL storage using localStorage
    urlStorage: {
      findAllUploads: async (): Promise<tus.PreviousUpload[]> => {
        const storedUrl = getStoredUploadUrl(fingerprint);
        if (storedUrl) {
          return [{
            uploadUrl: storedUrl,
            urlStorageKey: fingerprint,
            size: file.size,
            metadata: {},
            creationTime: new Date().toISOString(),
            parallelUploadUrls: null,
          }];
        }
        return [];
      },
      findUploadsByFingerprint: async (fp: string): Promise<tus.PreviousUpload[]> => {
        const storedUrl = getStoredUploadUrl(fp);
        if (storedUrl) {
          return [{
            uploadUrl: storedUrl,
            urlStorageKey: fp,
            size: file.size,
            metadata: {},
            creationTime: new Date().toISOString(),
            parallelUploadUrls: null,
          }];
        }
        return [];
      },
      removeUpload: async (urlStorageKey: string): Promise<void> => {
        clearStoredUploadUrl(urlStorageKey);
      },
      addUpload: async (fp: string, upload: tus.PreviousUpload): Promise<string> => {
        if (upload.uploadUrl) {
          storeUploadUrl(fp, upload.uploadUrl);
        }
        return fp;
      },
    },
    
    // Progress callback with speed calculation
    onProgress: (bytesUploaded: number, bytesTotal: number) => {
      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000; // seconds
      const bytesDiff = bytesUploaded - lastBytesUploaded;
      
      // Calculate speed (bytes per second)
      const instantSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
      const totalTime = (now - startTime) / 1000;
      const avgSpeed = totalTime > 0 ? bytesUploaded / totalTime : 0;
      const speed = (instantSpeed + avgSpeed) / 2;
      
      // Calculate remaining time
      const remainingBytes = bytesTotal - bytesUploaded;
      const remainingTime = speed > 0 ? remainingBytes / speed : 0;
      
      onProgress(bytesUploaded, bytesTotal, speed, remainingTime);
      
      lastBytesUploaded = bytesUploaded;
      lastTime = now;
    },
    
    // Success callback
    onSuccess: () => {
      clearStoredUploadUrl(fingerprint);
      onSuccess();
    },
    
    // Error callback with detailed error info
    onError: (error: Error | tus.DetailedError) => {
      console.error('TUS upload error:', error);
      
      // Check if it's a 423 Locked error — clear stale fingerprint and retry fresh
      let is423 = false;
      if ('originalResponse' in error) {
        const detailedError = error as tus.DetailedError;
        const statusCode = detailedError.originalResponse?.getStatus?.();
        console.error('TUS detailed error:', {
          causingError: detailedError.causingError,
          originalRequest: detailedError.originalRequest,
          originalResponse: detailedError.originalResponse,
          statusCode,
        });
        if (statusCode === 423) {
          is423 = true;
        }
      }
      
      // Also check the error message string for 423
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('423') || errorMsg.includes('locked')) {
        is423 = true;
      }

      if (is423) {
        console.log('Upload locked (423) — clearing stale fingerprint and retrying fresh...');
        clearStoredUploadUrl(fingerprint);
        // Small delay then retry without resuming from previous
        setTimeout(() => {
          upload.start();
        }, 2000);
        return;
      }
      
      onError(error instanceof Error ? error : new Error(String(error)));
    },
    
    // Called when upload URL is created (for resume tracking)
    onAfterResponse: (req, res) => {
      // Store the upload URL when created for resume capability
      const uploadUrl = (upload as any).url;
      if (uploadUrl) {
        storeUploadUrl(fingerprint, uploadUrl);
      }
    },
  });

  uploadInstance = upload;

  return {
    start: () => {
      // Check for previous uploads to resume
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          console.log('Resuming previous upload:', previousUploads[0]);
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    },
    
    pause: () => {
      if (uploadInstance) {
        uploadInstance.abort();
        // Don't clear the stored URL so we can resume
      }
    },
    
    resume: () => {
      // Check for previous uploads and resume
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    },
    
    abort: () => {
      if (uploadInstance) {
        uploadInstance.abort();
        clearStoredUploadUrl(fingerprint);
      }
    },
  };
}

/**
 * Check if a file has a previous incomplete upload
 */
export function hasPreviousUpload(file: File, videoId: string): boolean {
  const fingerprint = calculateFingerprint(file, videoId);
  return getStoredUploadUrl(fingerprint) !== null;
}

/**
 * Clear all stored upload URLs (for cleanup)
 */
export function clearAllStoredUploads(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(UPLOAD_STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn('Failed to clear stored uploads:', e);
  }
}

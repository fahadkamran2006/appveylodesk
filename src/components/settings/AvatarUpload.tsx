import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  currentUrl: string | null;
  name: string | null;
  onUpload: (file: File) => Promise<string | null>;
  size?: 'sm' | 'md' | 'lg';
}

export function AvatarUpload({ currentUrl, name, onUpload, size = 'lg' }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const getInitials = (name: string | null) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      setPreviewUrl(null);
    }
  };

  const displayUrl = previewUrl || currentUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar className={cn(sizeClasses[size], 'border-2 border-border')}>
          <AvatarImage src={displayUrl || undefined} alt={name || 'Avatar'} />
          <AvatarFallback className="bg-primary/20 text-primary text-2xl font-semibold">
            {getInitials(name) || <User className={iconSizes[size]} />}
          </AvatarFallback>
        </Avatar>

        {/* Overlay on hover */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            'absolute inset-0 rounded-full bg-black/60 flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer',
            isUploading && 'opacity-100'
          )}
        >
          {isUploading ? (
            <Loader2 className={cn(iconSizes[size], 'text-white animate-spin')} />
          ) : (
            <Camera className={cn(iconSizes[size], 'text-white')} />
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Camera className="w-4 h-4 mr-2" />
            Change Photo
          </>
        )}
      </Button>
    </div>
  );
}

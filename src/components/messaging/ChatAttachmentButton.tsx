import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Paperclip, Image, Video, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ChatAttachmentButtonProps {
  onSelectFile: (file: File) => void;
  uploading: boolean;
  progress: number;
  fileName?: string;
  onCancelUpload: () => void;
  disabled?: boolean;
}

export function ChatAttachmentButton({
  onSelectFile,
  uploading,
  progress,
  fileName,
  onCancelUpload,
  disabled,
}: ChatAttachmentButtonProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = () => {
    imageInputRef.current?.click();
  };

  const handleVideoSelect = () => {
    videoInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
    // Reset input
    event.target.value = '';
  };

  if (uploading) {
    return (
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 min-w-[200px]">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground truncate">{fileName}</p>
          <Progress value={progress} className="h-1.5 mt-1" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onCancelUpload}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-40 p-2">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleImageSelect}
            >
              <Image className="w-4 h-4" />
              Image
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleVideoSelect}
            >
              <Video className="w-4 h-4" />
              Video
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

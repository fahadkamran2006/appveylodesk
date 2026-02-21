import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
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
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="shrink-0"
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip className="w-4 h-4" />
      </Button>
    </>
  );
}

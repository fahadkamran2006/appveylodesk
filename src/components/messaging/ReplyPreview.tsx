import { X } from 'lucide-react';

interface ReplyPreviewProps {
  senderName: string;
  content: string;
  onCancel: () => void;
}

export function ReplyPreview({ senderName, content, onCancel }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-border/50">
      <div className="w-1 h-8 bg-primary rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">{senderName}</p>
        <p className="text-xs text-muted-foreground truncate">{content}</p>
      </div>
      <button onClick={onCancel} className="p-1 rounded hover:bg-muted text-muted-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

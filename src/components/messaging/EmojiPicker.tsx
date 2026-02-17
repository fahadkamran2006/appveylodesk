import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { useState } from 'react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <Smile className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="top" align="start" sideOffset={8}>
        <div className="flex gap-1">
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(emoji);
                setOpen(false);
              }}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

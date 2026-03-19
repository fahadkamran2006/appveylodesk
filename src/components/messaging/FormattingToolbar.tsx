import { Bold, Italic, Code, Strikethrough, List, ListOrdered, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FormattingToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

interface FormatAction {
  icon: React.ElementType;
  label: string;
  shortcut: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const FORMAT_ACTIONS: FormatAction[] = [
  { icon: Bold, label: 'Bold', shortcut: 'Ctrl+B', prefix: '**', suffix: '**' },
  { icon: Italic, label: 'Italic', shortcut: 'Ctrl+I', prefix: '*', suffix: '*' },
  { icon: Strikethrough, label: 'Strikethrough', shortcut: 'Ctrl+Shift+X', prefix: '~~', suffix: '~~' },
  { icon: Code, label: 'Code', shortcut: 'Ctrl+E', prefix: '`', suffix: '`' },
  { icon: Quote, label: 'Quote', shortcut: '', prefix: '> ', suffix: '', block: true },
];

function applyFormat(
  textarea: HTMLTextAreaElement,
  value: string,
  action: FormatAction,
): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);

  if (action.block) {
    // Block-level: prefix each line
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const actualEnd = lineEnd === -1 ? value.length : lineEnd;
    const lines = value.slice(lineStart, actualEnd);
    const prefixed = lines
      .split('\n')
      .map((l) => `${action.prefix}${l}`)
      .join('\n');
    const newValue = value.slice(0, lineStart) + prefixed + value.slice(actualEnd);

    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        lineStart,
        lineStart + prefixed.length,
      );
    });
    return newValue;
  }

  if (selected) {
    // Wrap selection
    const wrapped = `${action.prefix}${selected}${action.suffix}`;
    const newValue = value.slice(0, start) + wrapped + value.slice(end);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + action.prefix.length,
        start + action.prefix.length + selected.length,
      );
    });
    return newValue;
  }

  // No selection: insert markers and place cursor between them
  const inserted = `${action.prefix}${action.suffix}`;
  const newValue = value.slice(0, start) + inserted + value.slice(end);
  requestAnimationFrame(() => {
    textarea.focus();
    const cursorPos = start + action.prefix.length;
    textarea.setSelectionRange(cursorPos, cursorPos);
  });
  return newValue;
}

export function FormattingToolbar({ textareaRef, value, onChange, className }: FormattingToolbarProps) {
  const handleFormat = (action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const newValue = applyFormat(textarea, value, action);
    onChange(newValue);
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className={cn('flex items-center gap-0.5', className)}>
        {FORMAT_ACTIONS.map((action) => (
          <Tooltip key={action.label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep textarea focus
                  handleFormat(action);
                }}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <action.icon className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <span>{action.label}</span>
              {action.shortcut && (
                <span className="ml-1.5 text-muted-foreground">{action.shortcut}</span>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

import { cn } from '@/lib/utils';

interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
  hasReacted: boolean;
}

interface MessageReactionsProps {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
  isOwn: boolean;
}

export function MessageReactions({ reactions, onToggle, isOwn }: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
      {reactions.map(r => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors',
            r.hasReacted
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
          )}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
    </div>
  );
}

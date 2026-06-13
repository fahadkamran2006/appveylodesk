import { Command } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PoweredByVeylodeskProps {
  className?: string;
  variant?: 'compact' | 'footer';
}

export function PoweredByVeylodesk({ className, variant = 'compact' }: PoweredByVeylodeskProps) {
  return (
    <a
      href="https://veylodesk.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors',
        variant === 'footer' ? 'text-xs justify-center w-full py-3' : 'text-[11px]',
        className
      )}
    >
      <span>Powered by</span>
      <span className="inline-flex items-center gap-1 font-semibold">
        <Command className="w-3 h-3" />
        Veylodesk
      </span>
    </a>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceNotePlayerProps {
  messageId: string;
  attachmentUrl: string;
  durationSeconds: number;
  isOwn: boolean;
}

const BAR_COUNT = 28;

// Generate deterministic waveform from messageId so it doesn't change on re-render
function generateWaveform(seed: string, count: number): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    const val = Math.abs(hash % 100);
    // Create natural-looking waveform with peaks in the middle
    const position = i / count;
    const envelope = Math.sin(position * Math.PI) * 0.6 + 0.4;
    bars.push(Math.max(3, (val / 100) * 18 * envelope + 3));
  }
  return bars;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceNotePlayer({ messageId, attachmentUrl, durationSeconds, isOwn }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [currentTime, setCurrentTime] = useState(0);
  const animRef = useRef<number>(0);
  const waveform = useRef(generateWaveform(messageId, BAR_COUNT)).current;

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      const p = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      setProgress(p);
      setCurrentTime(audio.currentTime);
      animRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().then(() => {
        setPlaying(true);
        animRef.current = requestAnimationFrame(updateProgress);
      }).catch(err => {
        console.error('Voice playback failed:', err);
      });
    } else {
      audio.pause();
      setPlaying(false);
      cancelAnimationFrame(animRef.current);
    }
  }, [updateProgress]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    cancelAnimationFrame(animRef.current);
  }, []);

  // Seek by clicking on waveform
  const handleBarClick = useCallback((index: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const seekTo = (index / BAR_COUNT) * audio.duration;
    audio.currentTime = seekTo;
    setProgress(index / BAR_COUNT);
    setCurrentTime(seekTo);
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const displayTime = playing || progress > 0
    ? formatTime(currentTime)
    : formatTime(durationSeconds);

  return (
    <div className="px-3 py-2.5 flex items-center gap-3 min-w-[200px]">
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200',
          isOwn
            ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground'
            : 'bg-primary/10 hover:bg-primary/20 text-primary'
        )}
      >
        {playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      {/* Waveform */}
      <div className="flex items-center gap-[2px] flex-1 h-7 cursor-pointer">
        {waveform.map((height, i) => {
          const filled = i / BAR_COUNT <= progress;
          return (
            <div
              key={i}
              onClick={() => handleBarClick(i)}
              className={cn(
                'w-[3px] rounded-full transition-colors duration-150',
                filled
                  ? isOwn
                    ? 'bg-primary-foreground/90'
                    : 'bg-primary'
                  : isOwn
                    ? 'bg-primary-foreground/25'
                    : 'bg-muted-foreground/30'
              )}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className={cn(
        'text-[11px] font-medium tabular-nums flex-shrink-0',
        isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
      )}>
        {displayTime}
      </span>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={attachmentUrl}
        preload="metadata"
        onEnded={handleEnded}
      />
    </div>
  );
}

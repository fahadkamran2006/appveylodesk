import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceNotePlayerProps {
  messageId: string;
  attachmentUrl: string;
  durationSeconds: number;
  isOwn: boolean;
}

const BAR_COUNT = 32;

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
    const position = i / count;
    const envelope = Math.sin(position * Math.PI) * 0.6 + 0.4;
    bars.push(Math.max(4, (val / 100) * 24 * envelope + 4));
  }
  return bars;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceNotePlayer({ messageId, attachmentUrl, durationSeconds, isOwn }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const animRef = useRef<number>(0);
  const waveform = useRef(generateWaveform(messageId, BAR_COUNT)).current;

  // Use Audio constructor — do NOT set crossOrigin to avoid CORS failures on public bucket URLs
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = attachmentUrl;
    audioRef.current = audio;

    const onLoaded = () => setLoaded(true);
    const onError = (e: Event) => {
      console.error('Voice note load error:', e);
      setError(true);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      cancelAnimationFrame(animRef.current);
    };

    audio.addEventListener('canplaythrough', onLoaded);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('canplaythrough', onLoaded);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
      cancelAnimationFrame(animRef.current);
      audioRef.current = null;
    };
  }, [attachmentUrl]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      const dur = audio.duration || durationSeconds;
      const p = dur > 0 ? audio.currentTime / dur : 0;
      setProgress(p);
      setCurrentTime(audio.currentTime);
      animRef.current = requestAnimationFrame(updateProgress);
    }
  }, [durationSeconds]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
        animRef.current = requestAnimationFrame(updateProgress);
      } catch (err) {
        console.error('Voice playback failed:', err);
        setError(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
      cancelAnimationFrame(animRef.current);
    }
  }, [updateProgress]);

  const handleBarClick = useCallback((index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration || durationSeconds;
    if (!dur) return;
    const seekTo = (index / BAR_COUNT) * dur;
    audio.currentTime = seekTo;
    setProgress(index / BAR_COUNT);
    setCurrentTime(seekTo);
  }, [durationSeconds]);

  const displayTime = playing || progress > 0
    ? formatTime(currentTime)
    : formatTime(durationSeconds);

  if (error) {
    return (
      <div className="px-3 py-2.5 flex items-center gap-2 min-w-[180px]">
        <Mic className={cn('w-4 h-4', isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground')} />
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'text-xs underline',
            isOwn ? 'text-primary-foreground/70' : 'text-primary'
          )}
        >
          Play voice note ↗
        </a>
        <span className={cn('text-[11px] tabular-nums ml-auto', isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground')}>
          {formatTime(durationSeconds)}
        </span>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 flex items-center gap-2.5 min-w-[220px]">
      {/* Play/Pause */}
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
      <div className="flex items-center gap-[2px] flex-1 h-8 cursor-pointer">
        {waveform.map((height, i) => {
          const filled = i / BAR_COUNT <= progress;
          return (
            <div
              key={i}
              onClick={() => handleBarClick(i)}
              className={cn(
                'w-[2.5px] rounded-full transition-all duration-150',
                filled
                  ? isOwn
                    ? 'bg-primary-foreground'
                    : 'bg-primary'
                  : isOwn
                    ? 'bg-primary-foreground/25'
                    : 'bg-muted-foreground/25'
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
    </div>
  );
}

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Send, Play, Pause, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecordButtonProps {
  onSendVoice: (blob: Blob, durationSeconds: number) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'preview';

const VISUALIZER_BARS = 24;

export function VoiceRecordButton({ onSendVoice, onRecordingStateChange, disabled }: VoiceRecordButtonProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>(new Array(VISUALIZER_BARS).fill(4));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  const recordedBlobRef = useRef<Blob | null>(null);
  const recordedDurationRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAnimRef = useRef<number>(0);

  // Live waveform analyzer
  const updateWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const step = Math.floor(data.length / VISUALIZER_BARS);
    const bars: number[] = [];
    for (let i = 0; i < VISUALIZER_BARS; i++) {
      const val = data[i * step] || 0;
      bars.push(Math.max(4, (val / 255) * 28));
    }
    setLiveWaveform(bars);
    animFrameRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyser for live waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        recordedBlobRef.current = blob;
        recordedDurationRef.current = Math.max(1, elapsed);

        // Create preview audio
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        previewAudioRef.current = audio;

        audio.onended = () => {
          setPreviewPlaying(false);
          setPreviewProgress(0);
          cancelAnimationFrame(previewAnimRef.current);
        };

        setState('preview');
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setState('recording');
      onRecordingStateChange?.(true);

      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 250);

      // Start waveform animation
      animFrameRef.current = requestAnimationFrame(updateWaveform);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, [updateWaveform]);

  const stopRecording = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Stop tracks but keep the blob
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    analyserRef.current = null;
    mediaRecorderRef.current?.stop();
  }, []);

  const discardRecording = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    cancelAnimationFrame(previewAnimRef.current);
    recordedBlobRef.current = null;
    recordedDurationRef.current = 0;
    setDuration(0);
    setPreviewPlaying(false);
    setPreviewProgress(0);
    setLiveWaveform(new Array(VISUALIZER_BARS).fill(4));
    setState('idle');
    onRecordingStateChange?.(false);
  }, [onRecordingStateChange]);

  const sendRecording = useCallback(() => {
    const blob = recordedBlobRef.current;
    const dur = recordedDurationRef.current;
    if (blob && dur > 0) {
      onSendVoice(blob, dur);
    }
    // Cleanup
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    cancelAnimationFrame(previewAnimRef.current);
    recordedBlobRef.current = null;
    recordedDurationRef.current = 0;
    setDuration(0);
    setPreviewPlaying(false);
    setPreviewProgress(0);
    setLiveWaveform(new Array(VISUALIZER_BARS).fill(4));
    setState('idle');
    onRecordingStateChange?.(false);
  }, [onSendVoice, onRecordingStateChange]);

  const togglePreviewPlayback = useCallback(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().then(() => {
        setPreviewPlaying(true);
        const tick = () => {
          if (!audio.paused) {
            const p = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
            setPreviewProgress(p);
            previewAnimRef.current = requestAnimationFrame(tick);
          }
        };
        previewAnimRef.current = requestAnimationFrame(tick);
      });
    } else {
      audio.pause();
      setPreviewPlaying(false);
      cancelAnimationFrame(previewAnimRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      cancelAnimationFrame(previewAnimRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // --- RECORDING STATE ---
  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Delete / cancel */}
        <button
          onClick={() => {
            stopRecording();
            // Override onstop to discard
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.onstop = () => {
                streamRef.current?.getTracks().forEach(t => t.stop());
                audioContextRef.current?.close();
                discardRecording();
              };
            }
            // Fallback: if already stopped
            cancelAnimationFrame(animFrameRef.current);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          }}
          className="p-1.5 rounded-full text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Live waveform */}
        <div className="flex items-center gap-[2px] flex-1 h-7">
          {liveWaveform.map((height, i) => (
            <div
              key={i}
              className="w-[2.5px] rounded-full bg-destructive/70 transition-all duration-100"
              style={{ height: `${height}px` }}
            />
          ))}
        </div>

        {/* Recording indicator + time */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs font-medium text-destructive tabular-nums">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Stop & go to preview */}
        <button
          onClick={stopRecording}
          className="p-1.5 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors flex-shrink-0"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // --- PREVIEW STATE ---
  if (state === 'preview') {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Delete */}
        <button
          onClick={discardRecording}
          className="p-1.5 rounded-full text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Play/Pause preview */}
        <button
          onClick={togglePreviewPlayback}
          className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex-shrink-0"
        >
          {previewPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${previewProgress * 100}%` }}
          />
        </div>

        {/* Duration */}
        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
          {formatDuration(recordedDurationRef.current)}
        </span>

        {/* Send */}
        <button
          onClick={sendRecording}
          className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // --- IDLE STATE ---
  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
}

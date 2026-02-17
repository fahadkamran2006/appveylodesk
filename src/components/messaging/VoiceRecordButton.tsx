import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecordButtonProps {
  onSendVoice: (blob: Blob, durationSeconds: number) => void;
  disabled?: boolean;
}

export function VoiceRecordButton({ onSendVoice, disabled }: VoiceRecordButtonProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (elapsed > 0) {
          onSendVoice(blob, elapsed);
        }
        setRecording(false);
        setDuration(0);
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setRecording(true);

      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, [onSendVoice]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs font-medium text-destructive tabular-nums">{formatDuration(duration)}</span>
        </div>
        <button
          onClick={stopRecording}
          className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    );
  }

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

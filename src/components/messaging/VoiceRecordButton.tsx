import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Send, Play, Pause, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceRecordButtonProps {
  onSendVoice: (blob: Blob, durationSeconds: number) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'preview';

const VISUALIZER_BARS = 32;

export function VoiceRecordButton({ onSendVoice, onRecordingStateChange, disabled }: VoiceRecordButtonProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>(new Array(VISUALIZER_BARS).fill(3));
  const [micError, setMicError] = useState(false);

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

    const step = Math.max(1, Math.floor(data.length / VISUALIZER_BARS));
    const bars: number[] = [];
    for (let i = 0; i < VISUALIZER_BARS; i++) {
      const val = data[i * step] || 0;
      bars.push(Math.max(3, (val / 255) * 32));
    }
    setLiveWaveform(bars);
    animFrameRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = useCallback(async () => {
    setMicError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          sampleRate: 44100 
        } 
      });
      streamRef.current = stream;

      // Set up audio analyser for live waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Try different MIME types for broader compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const actualMime = mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });
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

      mediaRecorder.start(200);
      startTimeRef.current = Date.now();
      setDuration(0);
      setState('recording');
      onRecordingStateChange?.(true);

      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 200);

      // Start waveform animation
      animFrameRef.current = requestAnimationFrame(updateWaveform);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setMicError(true);
      setTimeout(() => setMicError(false), 3000);
    }
  }, [updateWaveform, onRecordingStateChange]);

  const stopRecording = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close().catch(() => {});
    analyserRef.current = null;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
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
    setLiveWaveform(new Array(VISUALIZER_BARS).fill(3));
    setState('idle');
    onRecordingStateChange?.(false);
  }, [onRecordingStateChange]);

  const cancelAndDiscard = useCallback(() => {
    // Stop recording and discard
    cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close().catch(() => {});
    analyserRef.current = null;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Override onstop to discard
      mediaRecorderRef.current.onstop = () => {
        discardRecording();
      };
      mediaRecorderRef.current.stop();
    } else {
      discardRecording();
    }
  }, [discardRecording]);

  const sendRecording = useCallback(() => {
    const blob = recordedBlobRef.current;
    const dur = recordedDurationRef.current;
    if (blob && dur > 0) {
      onSendVoice(blob, dur);
    }
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
    setLiveWaveform(new Array(VISUALIZER_BARS).fill(3));
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
      }).catch(err => console.error('Preview playback failed:', err));
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
      audioContextRef.current?.close().catch(() => {});
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
      <motion.div
        initial={{ opacity: 0, scaleX: 0.8 }}
        animate={{ opacity: 1, scaleX: 1 }}
        exit={{ opacity: 0, scaleX: 0.8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex items-center gap-2 flex-1 min-w-0 bg-destructive/5 rounded-full px-2 py-1"
      >
        {/* Delete / cancel */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={cancelAndDiscard}
          className="p-1.5 rounded-full text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>

        {/* Live waveform */}
        <div className="flex items-center gap-[1.5px] flex-1 h-8 overflow-hidden">
          {liveWaveform.map((height, i) => (
            <motion.div
              key={i}
              animate={{ height: `${height}px` }}
              transition={{ type: 'spring', stiffness: 400, damping: 15, mass: 0.3 }}
              className="w-[2px] rounded-full bg-destructive/60"
            />
          ))}
        </div>

        {/* Recording indicator + time */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-2 h-2 rounded-full bg-destructive"
          />
          <span className="text-xs font-semibold text-destructive tabular-nums min-w-[32px]">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Stop & go to preview */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={stopRecording}
          className="p-2 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground transition-colors flex-shrink-0"
        >
          <Square className="w-3.5 h-3.5" />
        </motion.button>
      </motion.div>
    );
  }

  // --- PREVIEW STATE ---
  if (state === 'preview') {
    return (
      <motion.div
        initial={{ opacity: 0, scaleX: 0.8 }}
        animate={{ opacity: 1, scaleX: 1 }}
        exit={{ opacity: 0, scaleX: 0.8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex items-center gap-2 flex-1 min-w-0 bg-primary/5 rounded-full px-2 py-1"
      >
        {/* Delete */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={discardRecording}
          className="p-1.5 rounded-full text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>

        {/* Play/Pause preview */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={togglePreviewPlayback}
          className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex-shrink-0"
        >
          {previewPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </motion.button>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${previewProgress * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Duration */}
        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 min-w-[32px] text-center font-medium">
          {formatDuration(recordedDurationRef.current)}
        </span>

        {/* Send */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.05 }}
          onClick={sendRecording}
          className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0 shadow-sm"
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </motion.div>
    );
  }

  // --- IDLE STATE ---
  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.1 }}
        onClick={startRecording}
        disabled={disabled}
        className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40"
      >
        <Mic className="w-5 h-5" />
      </motion.button>
      
      <AnimatePresence>
        {micError && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs whitespace-nowrap shadow-lg"
          >
            Microphone access denied
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Voice Chat Hook - Recreated based on stable Neurotracer logic
 * Simple, robust pipeline: getUserMedia → AudioContext → Speech Recognition
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseVoiceChatOptions {
  onMessage: (message: string) => void;
  onStart?: () => void;
  onStop?: () => void;
  silenceTimeoutMs?: number;
  minRecordingDurationMs?: number;
  language?: string;
  isAssistantSpeaking?: boolean; // New: for pause/resume management
}

export interface UseVoiceChatReturn {
  // Core functionality
  start(): Promise<void>;
  stop(): void;
  
  // State
  isSupported: boolean;
  isRecording: boolean;
  transcript: string;
  level: number; // 0..1 for visualizer
  
  // Platform-specific
  platform: 'web' | 'mobile';
  error?: string;
}

export const useVoiceChat = (options: UseVoiceChatOptions): UseVoiceChatReturn => {
  const {
    onMessage,
    onStart,
    onStop,
    silenceTimeoutMs = 2000,
    minRecordingDurationMs = 500,
    language = 'it-IT',
    isAssistantSpeaking = false
  } = options;

  // State - always declared at the top
  const [isClient, setIsClient] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string>();

  // Refs - always declared at the top
  const recognitionRef = useRef<any | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const silenceTimeoutRef = useRef<NodeJS.Timeout>();
  const resumeTimeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(0);
  const wasPausedByAssistant = useRef<boolean>(false);

  // Client-side initialization
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Normalize transcript with basic punctuation - like Neurotracer
  const normalizeTranscript = useCallback((text: string): string => {
    if (!text.trim()) return text;

    let normalized = text.trim();
    
    // Add question mark for interrogative words
    const questionWords = ['come', 'cosa', 'dove', 'quando', 'perché', 'chi', 'quale', 'quanto'];
    const firstWord = normalized.toLowerCase().split(' ')[0];
    
    if (questionWords.includes(firstWord) && !normalized.endsWith('?')) {
      normalized += '?';
    } else if (!normalized.match(/[.!?]$/)) {
      // Add period if no punctuation at end
      normalized += '.';
    }
    
    // Capitalize first letter
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    
    return normalized;
  }, []);

  // Initialize Speech Recognition - Neurotracer style
  useEffect(() => {
    if (!isClient) return;

    // Feature detection
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const hasUserMedia = !!navigator.mediaDevices?.getUserMedia;
    const supported = !!(SpeechRecognition && hasUserMedia);

    console.log('[VoiceChat] Feature detection:', {
      supported,
      hasSR: !!SpeechRecognition,
      hasMedia: hasUserMedia,
      userAgent: navigator.userAgent.substring(0, 50)
    });

    setIsSupported(supported);
    if (!supported) return;

    // Create Speech Recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      console.log('[VoiceChat] Speech recognition started');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript = finalTranscript + interimTranscript;
      setTranscript(currentTranscript);

      // Reset silence timeout when there's vocal activity
      if (finalTranscript || interimTranscript) {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        
        silenceTimeoutRef.current = setTimeout(() => {
          if (finalTranscript.trim()) {
            const duration = Date.now() - startTimeRef.current;
            if (duration >= minRecordingDurationMs) {
              const normalizedText = normalizeTranscript(finalTranscript.trim());
              console.log('[VoiceChat] Sending normalized transcript:', normalizedText);
              onMessage(normalizedText);
              setTranscript('');
            }
          }
        }, silenceTimeoutMs);
      }
    };

    recognition.onerror = (event: any) => {
      // Handle "aborted" as debug only (not error) - as requested in bug report
      if (event.error === 'aborted') {
        console.log('[VoiceChat] 🔇 Speech recognition aborted (expected during TTS)');
        // Don't set error state for intentional aborts
        return;
      }
      
      console.error('[VoiceChat] Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('[VoiceChat] Speech recognition ended');
      
      // GUARD: Don't auto-restart if assistant is speaking
      if (isAssistantSpeaking) {
        console.log('[VoiceChat] 🚫 Not restarting SR - assistant is speaking');
        return;
      }
      
      // Auto-restart if still recording and not paused by assistant
      if (isRecording && recognitionRef.current && !wasPausedByAssistant.current) {
        setTimeout(() => {
          if (isRecording && recognitionRef.current && !isAssistantSpeaking) {
            try {
              console.log('[VoiceChat] 🔄 Auto-restarting recognition');
              recognitionRef.current.start();
            } catch (e) {
              console.warn('[VoiceChat] Failed to restart recognition:', e);
            }
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    // Cleanup on unmount
    return () => {
      if (recognition) {
        try {
          recognition.abort();
        } catch (e) {
          console.warn('[VoiceChat] Error aborting recognition:', e);
        }
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [isClient, language, onMessage, silenceTimeoutMs, minRecordingDurationMs, isRecording]);

  // Handle assistant speaking - pause/resume like Neurotracer
  useEffect(() => {
    if (isAssistantSpeaking && isRecording) {
      console.log('[VoiceChat] Pausing recognition - assistant started speaking');
      wasPausedByAssistant.current = true;
      
      // Stop recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.warn('[VoiceChat] Error stopping recognition:', e);
        }
      }
      
      // Clear any pending timeouts
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = undefined;
      }
      
      setTranscript(''); // Clear transcript during pause
      
    } else if (!isAssistantSpeaking && wasPausedByAssistant.current && !isRecording) {
      console.log('[VoiceChat] Resuming recognition - assistant stopped speaking');
      
      // Clear any existing resume timeout
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
      
      // Resume after 1.5s delay like Neurotracer
      resumeTimeoutRef.current = setTimeout(() => {
        if (!isAssistantSpeaking && recognitionRef.current && wasPausedByAssistant.current) {
          try {
            console.log('[VoiceChat] Restarting recognition after assistant pause');
            recognitionRef.current.start();
            setIsRecording(true);
            wasPausedByAssistant.current = false;
          } catch (e) {
            console.warn('[VoiceChat] Error restarting recognition:', e);
          }
        }
      }, 1500);
    }
  }, [isAssistantSpeaking, isRecording]);

  // Audio monitoring - Neurotracer style with real-time analysis
  const startAudioMonitoring = useCallback(async () => {
    if (!isClient) return;

    try {
      console.log('[VoiceChat] Starting audio monitoring...');

      // Get user media - simple and robust like Neurotracer
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('[VoiceChat] Got media stream:', {
        tracks: stream.getTracks().length,
        audioTracks: stream.getAudioTracks().length,
        firstTrackState: stream.getAudioTracks()[0]?.readyState
      });

      streamRef.current = stream;

      // Create AudioContext for real-time analysis - like Chat.tsx in Neurotracer
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      console.log('[VoiceChat] AudioContext state:', audioContext.state);

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      // Configure analyser - similar to Neurotracer settings
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start real-time level monitoring
      const timeData = new Uint8Array(analyser.fftSize);
      let frameCount = 0;

      const updateLevel = () => {
        if (!analyserRef.current || !isRecording) {
          console.log('[VoiceChat] Stopping level monitoring at frame:', frameCount);
          return;
        }

        analyserRef.current.getByteTimeDomainData(timeData);

        // Calculate RMS like in Neurotracer Chat.tsx
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const sample = (timeData[i] - 128) / 128;
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / timeData.length);
        const normalizedLevel = Math.min(rms * 3, 1); // Slight amplification for UI

        // Debug first few frames
        if (frameCount < 5) {
          console.log(`[VoiceChat] Frame ${frameCount}: RMS=${rms.toFixed(4)}, level=${normalizedLevel.toFixed(4)}`);
        }

        setLevel(normalizedLevel);
        frameCount++;

        if (isRecording) {
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };

      // Start monitoring
      updateLevel();
      console.log('[VoiceChat] Audio monitoring started successfully');

    } catch (err: any) {
      console.error('[VoiceChat] Failed to start audio monitoring:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please check your microphone connection.');
      } else {
        setError(`Failed to access microphone: ${err.message}`);
      }
    }
  }, [isClient, isRecording]);

  const stopAudioMonitoring = useCallback(() => {
    console.log('[VoiceChat] Stopping audio monitoring...');

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    // Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log(`[VoiceChat] Stopping ${track.kind} track:`, track.readyState);
        track.stop();
      });
      streamRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setLevel(0);
    console.log('[VoiceChat] Audio monitoring stopped');
  }, []);

  // Start function - simple and clean like Neurotracer
  const start = useCallback(async () => {
    if (!isSupported || isRecording || !isClient || isAssistantSpeaking) {
      console.log('[VoiceChat] Cannot start:', { 
        isSupported, 
        isRecording, 
        isClient, 
        isAssistantSpeaking: isAssistantSpeaking ? 'BLOCKED - Assistant speaking' : false 
      });
      return;
    }

    try {
      console.log('[VoiceChat] Starting voice chat...');
      setError(undefined);
      setTranscript('');
      startTimeRef.current = Date.now();

      // Start audio monitoring first
      await startAudioMonitoring();

      // Then start recording
      setIsRecording(true);

      // Start speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          console.log('[VoiceChat] Speech recognition started');
        } catch (e) {
          console.warn('[VoiceChat] Recognition start failed:', e);
        }
      }

      onStart?.();
      console.log('[VoiceChat] Voice chat started successfully');

    } catch (err: any) {
      console.error('[VoiceChat] Failed to start voice chat:', err);
      setError(`Failed to start voice chat: ${err.message}`);
      setIsRecording(false);
    }
  }, [isSupported, isRecording, isClient, startAudioMonitoring, onStart]);

  // Stop function - clean like Neurotracer
  const stop = useCallback(() => {
    if (!isRecording) return;

    console.log('[VoiceChat] Stopping voice chat...');
    setIsRecording(false);

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        console.warn('[VoiceChat] Error stopping recognition:', e);
      }
    }

    // Clear all timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = undefined;
    }
    
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = undefined;
    }

    // Stop audio monitoring
    stopAudioMonitoring();

    // Send final transcript if available
    const finalTranscript = transcript.trim();
    const duration = Date.now() - startTimeRef.current;

    if (finalTranscript && duration >= minRecordingDurationMs) {
      const normalizedText = normalizeTranscript(finalTranscript);
      console.log('[VoiceChat] Sending final normalized transcript:', normalizedText);
      onMessage(normalizedText);
    }

    setTranscript('');
    setError(undefined);
    onStop?.();
    console.log('[VoiceChat] Voice chat stopped successfully');
  }, [isRecording, transcript, minRecordingDurationMs, onMessage, onStop, stopAudioMonitoring]);

  // Always return the same shape
  return {
    start,
    stop,
    isSupported,
    isRecording,
    transcript,
    level,
    platform: 'web',
    error
  };
};

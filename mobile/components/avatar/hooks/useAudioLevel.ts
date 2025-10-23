import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-audio';
import { AudioLevel } from '../../../types/avatar.types';

/**
 * Hook per il monitoraggio del livello audio per lipsync
 */
export const useAudioLevel = (audioUri?: string) => {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Carica e riproduce audio
   */
  const playAudio = useCallback(async (uri: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Pulisci audio precedente
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Carica nuovo audio
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, isLooping: false }
      );

      soundRef.current = sound;

      // Setup listener per stato
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying || false);
          
          if (status.isPlaying) {
            startAudioMonitoring();
          } else {
            stopAudioMonitoring();
          }
        }
      });

      console.log('[useAudioLevel] 🎵 Audio caricato e riprodotto');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento audio');
      console.error('[useAudioLevel] ❌ Errore audio:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Ferma la riproduzione
   */
  const stopAudio = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        stopAudioMonitoring();
      }
    } catch (err) {
      console.error('[useAudioLevel] ❌ Errore stop audio:', err);
    }
  }, []);

  /**
   * Avvia il monitoraggio del livello audio
   */
  const startAudioMonitoring = useCallback(() => {
    if (intervalRef.current) return;

    console.log('[useAudioLevel] 📊 Avvio monitoraggio audio');
    
    intervalRef.current = setInterval(() => {
      if (soundRef.current) {
        // Simula livello audio basato su posizione
        // In futuro useremo l'RMS reale
        const mockLevel = Math.random() * 0.8 + 0.1;
        setAudioLevel(mockLevel);
      }
    }, 50); // 20fps per lipsync fluido
  }, []);

  /**
   * Ferma il monitoraggio del livello audio
   */
  const stopAudioMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Fade out del livello audio
    const fadeOut = () => {
      setAudioLevel(prev => {
        const newLevel = prev * 0.9;
        if (newLevel > 0.01) {
          animationFrameRef.current = requestAnimationFrame(fadeOut);
        }
        return newLevel;
      });
    };
    
    fadeOut();
    
    console.log('[useAudioLevel] 📊 Monitoraggio audio fermato');
  }, []);

  /**
   * Simula livello audio per testing
   */
  const simulateAudioLevel = useCallback((level: number) => {
    setAudioLevel(Math.max(0, Math.min(level, 1)));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Auto-play se audioUri cambia
  useEffect(() => {
    if (audioUri) {
      playAudio(audioUri);
    }
  }, [audioUri, playAudio]);

  return {
    audioLevel,
    isPlaying,
    isLoading,
    error,
    playAudio,
    stopAudio,
    simulateAudioLevel,
  };
};

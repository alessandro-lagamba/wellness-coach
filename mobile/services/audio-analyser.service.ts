import { Audio } from 'expo-av';

/**
 * Audio Analyser per React Native - Basato su analyser.ts di audio-orb
 * 
 * Analizza audio real-time e fornisce dati per visualizzazioni
 */
export class AudioAnalyser {
  private recording: Audio.Recording | null = null;
  private isAnalyzing = false;
  private analysisInterval: NodeJS.Timeout | null = null;
  private audioLevels: {
    input: number;
    output: number;
    bass: number;
    mid: number;
    treble: number;
  } = {
    input: 0,
    output: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  };

  private callbacks: {
    onAudioLevelUpdate?: (levels: typeof this.audioLevels) => void;
    onAudioData?: (pcmData: Float32Array) => void;
  } = {};

  constructor() {}

  /**
   * Avvia analisi audio
   */
  async startAnalysis(): Promise<void> {
    if (this.isAnalyzing) return;

    try {
      // ✅ Richiedi permessi microfono
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      // ✅ Configura modalità audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // ✅ Avvia registrazione per analisi
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      await this.recording.startAsync();
      this.isAnalyzing = true;

      // ✅ Avvia loop di analisi
      this.startAnalysisLoop();

      console.log('[AudioAnalyser] ✅ Audio analysis started');

    } catch (error) {
      console.error('[AudioAnalyser] ❌ Error starting analysis:', error);
      throw error;
    }
  }

  /**
   * Ferma analisi audio
   */
  async stopAnalysis(): Promise<void> {
    if (!this.isAnalyzing) return;

    this.isAnalyzing = false;

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      } catch (error) {
        console.error('[AudioAnalyser] ❌ Error stopping recording:', error);
      }
    }

    // ✅ Reset livelli audio
    this.audioLevels = {
      input: 0,
      output: 0,
      bass: 0,
      mid: 0,
      treble: 0,
    };

    console.log('[AudioAnalyser] ✅ Audio analysis stopped');
  }

  /**
   * Loop di analisi audio (simulato per React Native)
   */
  private startAnalysisLoop(): void {
    this.analysisInterval = setInterval(() => {
      if (!this.isAnalyzing) return;

      // ✅ Simula analisi audio real-time
      // In una implementazione reale, qui analizzeresti i dati PCM
      this.simulateAudioAnalysis();
    }, 50); // 20 FPS per fluidità
  }

  /**
   * Simula analisi audio (da sostituire con analisi reale)
   */
  private simulateAudioAnalysis(): void {
    // ✅ Simula livelli audio basati su rumore di fondo
    const baseLevel = 0.1 + Math.random() * 0.2;
    
    this.audioLevels = {
      input: baseLevel + Math.random() * 0.3,
      output: baseLevel + Math.random() * 0.2,
      bass: baseLevel + Math.random() * 0.4,
      mid: baseLevel + Math.random() * 0.3,
      treble: baseLevel + Math.random() * 0.2,
    };

    // ✅ Simula dati PCM per invio a Gemini
    const pcmData = new Float32Array(256);
    for (let i = 0; i < pcmData.length; i++) {
      pcmData[i] = (Math.random() - 0.5) * 2; // -1 to 1
    }

    // ✅ Notifica callback
    if (this.callbacks.onAudioLevelUpdate) {
      this.callbacks.onAudioLevelUpdate(this.audioLevels);
    }

    if (this.callbacks.onAudioData) {
      this.callbacks.onAudioData(pcmData);
    }
  }

  /**
   * Imposta callback per aggiornamenti audio
   */
  setOnAudioLevelUpdate(callback: (levels: typeof this.audioLevels) => void): void {
    this.callbacks.onAudioLevelUpdate = callback;
  }

  /**
   * Imposta callback per dati audio PCM
   */
  setOnAudioData(callback: (pcmData: Float32Array) => void): void {
    this.callbacks.onAudioData = callback;
  }

  /**
   * Ottieni livelli audio correnti
   */
  getAudioLevels(): typeof this.audioLevels {
    return { ...this.audioLevels };
  }

  /**
   * Verifica se sta analizzando
   */
  isAnalyzingActive(): boolean {
    return this.isAnalyzing;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAnalysis();
    this.callbacks = {};
  }
}

export default AudioAnalyser;

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AudioAnalyser from './audio-analyser.service';

/**
 * Gemini Realtime Service - Backend Proxy Approach
 * 
 * Implementa chat vocale audio-to-audio a bassa latenza usando
 * Gemini-2.5-Flash-Native-Audio tramite backend proxy WebSocket
 * con supporto per lingua italiana
 */

export interface GeminiRealtimeOptions {
  backendUrl?: string;
  language?: string;
  voiceName?: string;
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onAudioChunk?: (chunk: string) => void;
  onTextChunk?: (chunk: string) => void;
  onResponseDone?: () => void;
  onError?: (error: Error) => void;
  onAudioLevelUpdate?: (levels: { input: number; output: number; bass: number; mid: number; treble: number }) => void;
}

export class GeminiRealtimeService {
  private static instance: GeminiRealtimeService | null = null;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isRecording = false;
  private audioAnalyser: AudioAnalyser;
  private options: GeminiRealtimeOptions | null = null;
  private recording: Audio.Recording | null = null;

  private constructor() {
    this.audioAnalyser = new AudioAnalyser();
  }

  public static getInstance(): GeminiRealtimeService {
    if (!GeminiRealtimeService.instance) {
      GeminiRealtimeService.instance = new GeminiRealtimeService();
    }
    return GeminiRealtimeService.instance;
  }

  public async connect(options: GeminiRealtimeOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[Gemini Realtime] 🔌 Connecting to backend proxy...');
        
        this.options = options;
        const { backendUrl = 'ws://10.163.94.238:8080' } = options;

        // Connetti al backend proxy WebSocket
        this.ws = new WebSocket(backendUrl);
        
        this.ws.onopen = () => {
          console.log('[Gemini Realtime] ✅ Connected to backend proxy');
          this.isConnected = true;
          
          // ✅ Configura AudioAnalyser DOPO la connessione
          this.audioAnalyser.setOnAudioLevelUpdate((levels) => {
            if (this.options?.onAudioLevelUpdate) {
              this.options.onAudioLevelUpdate(levels);
            }
          });
          
          // ✅ Risolvi la Promise quando il WebSocket è connesso
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[Gemini Realtime] 📨 Received:', data.type);
            
            switch (data.type) {
              case 'connected':
                console.log('[Gemini Realtime] ✅ Backend connection confirmed');
                break;
              
              case 'audio':
                // ✅ Gemini Live Audio chunk
                console.log('[Gemini Realtime] 🎵 Audio chunk received from Gemini');
                this.playAudioChunk(data.audioData, data.mimeType);
                if (this.options?.onAudioChunk) {
                  this.options.onAudioChunk(data.audioData);
                }
                break;
              
              case 'text':
                // ✅ Testo da Gemini
                console.log('[Gemini Realtime] 📝 Text:', data.text);
                if (this.options?.onTextChunk) {
                  this.options.onTextChunk(data.text);
                }
                break;
              
              case 'interrupted':
                // ✅ AI interrotto da user speech
                console.log('[Gemini Realtime] 🛑 AI interrupted');
                this.stopAllAudio();
                if (this.options?.onSpeechStarted) {
                  this.options.onSpeechStarted();
                }
                break;
              
              case 'response_complete':
                // ✅ Risposta completa
                console.log('[Gemini Realtime] ✅ Response complete');
                if (this.options?.onResponseDone) {
                  this.options.onResponseDone();
                }
                break;
                
              case 'error':
                console.error('[Gemini Realtime] ❌ Backend error:', data.message);
                if (this.options?.onError) {
                  this.options.onError(new Error(data.message));
                }
                break;
            }
          } catch (error) {
            console.error('[Gemini Realtime] ❌ Error parsing message:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('[Gemini Realtime] ❌ WebSocket error:', error);
          this.isConnected = false;
          if (this.options?.onError) {
            this.options.onError(error as Error);
          }
          // ✅ Rifiuta la Promise in caso di errore
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('[Gemini Realtime] 🔌 WebSocket closed');
          this.isConnected = false;
        };

        console.log('[Gemini Realtime] ⏳ Waiting for WebSocket connection...');

      } catch (error) {
        console.error('[Gemini Realtime] ❌ Connection failed:', error);
        if (this.options?.onError) {
          this.options.onError(error as Error);
        }
        reject(error);
      }
    });
  }

  public async startAudioRecording(): Promise<void> {
    try {
      console.log('[Gemini Realtime] 🎤 Starting continuous audio recording...');
      
      if (!this.isConnected || !this.ws) {
        throw new Error('Not connected to backend');
      }

      // ✅ Se già in registrazione, non fare nulla
      if (this.isRecording) {
        console.log('[Gemini Realtime] ⚠️ Already recording, skipping...');
        return;
      }

      // Richiedi permessi audio
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // ✅ Avvia registrazione continua (come audio-orb)
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      this.recording = recording;
      this.isRecording = true;
      
      // ✅ Avvia invio automatico di chunk audio ogni 100ms
      this.startContinuousAudioSending();
      
      // Avvia l'analisi audio per visualizzazioni
      await this.audioAnalyser.startAnalysis();
      
      console.log('[Gemini Realtime] ✅ Continuous audio recording started');

    } catch (error) {
      console.error('[Gemini Realtime] ❌ Failed to start recording:', error);
      throw error;
    }
  }

  private startContinuousAudioSending(): void {
    console.log('[Gemini Realtime] 🔄 Starting continuous audio sending...');
    
    // ✅ Invia audio chunks ogni 2 secondi (registrazione reale)
    const interval = setInterval(async () => {
      if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }

      try {
        // ✅ Crea una nuova registrazione temporanea per catturare audio
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        
        // ✅ Registra per 1 secondo
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // ✅ Ferma e ottieni l'audio
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        
        if (uri) {
          // ✅ Leggi il file audio
          const audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // ✅ Invia al backend
          this.ws.send(JSON.stringify({
            type: 'audio',
            audioData: audioBase64,
            mimeType: 'audio/wav'
          }));
          
          console.log('[Gemini Realtime] 📤 Sent real audio chunk to backend');
        }

      } catch (error) {
        console.error('[Gemini Realtime] ❌ Error sending audio chunk:', error);
      }
    }, 2000); // Ogni 2 secondi

    // ✅ Salva l'interval per cleanup
    (this as any).audioInterval = interval;
  }

  public async stopAudioRecording(): Promise<void> {
    try {
      console.log('[Gemini Realtime] 🛑 Stopping continuous audio recording...');
      
      if (!this.isRecording) {
        console.warn('[Gemini Realtime] ⚠️ No recording to stop');
        return;
      }
      
      // ✅ Ferma l'invio continuo di chunk
      if ((this as any).audioInterval) {
        clearInterval((this as any).audioInterval);
        (this as any).audioInterval = null;
        console.log('[Gemini Realtime] 🔄 Stopped continuous audio sending');
      }
      
      // ✅ Ferma la registrazione
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
      
      // ✅ Ferma l'analisi audio
      await this.audioAnalyser.stopAnalysis();
      
      this.isRecording = false;
      
      console.log('[Gemini Realtime] ✅ Continuous audio recording stopped');

    } catch (error) {
      console.error('[Gemini Realtime] ❌ Failed to stop recording:', error);
      throw error;
    }
  }

  public sendTextMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Gemini Realtime] ⚠️ WebSocket not connected, cannot send text');
      return;
    }
    
    try {
      this.ws.send(JSON.stringify({
        type: 'text',
        text: text
      }));
      console.log('[Gemini Realtime] 📤 Text sent to backend:', text);
    } catch (error) {
      console.error('[Gemini Realtime] ❌ Error sending text:', error);
    }
  }

  private audioQueue: Audio.Sound[] = [];
  private isPlayingAudio = false;

  private async playAudioChunk(audioBase64: string, mimeType: string): Promise<void> {
    try {
      console.log('[Gemini Realtime] 🔊 Playing audio chunk...');
      
      // ✅ Crea URI data per audio PCM da Gemini
      const dataUri = `data:${mimeType};base64,${audioBase64}`;
      
      // ✅ Carica audio chunk
      const { sound } = await Audio.Sound.createAsync(
        { uri: dataUri },
        { shouldPlay: !this.isPlayingAudio } // Play immediately se non c'è nulla in riproduzione
      );

      this.audioQueue.push(sound);

      // ✅ Gestisci queue
      if (!this.isPlayingAudio) {
        this.isPlayingAudio = true;
        this.playNextInQueue();
      }

      console.log('[Gemini Realtime] 🎵 Audio chunk loaded, queue size:', this.audioQueue.length);

    } catch (error) {
      console.error('[Gemini Realtime] ❌ Error playing audio chunk:', error);
    }
  }

  private async playNextInQueue(): Promise<void> {
    if (this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      console.log('[Gemini Realtime] ✅ Audio queue empty');
      return;
    }

    const sound = this.audioQueue.shift();
    if (!sound) return;

    try {
      // ✅ Configura callback per riprodurre il prossimo chunk
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('[Gemini Realtime] ✅ Chunk finished, playing next...');
          sound.unloadAsync();
          this.playNextInQueue(); // ✅ Riproduce il prossimo
        }
      });

      // ✅ Avvia riproduzione se non già in corso
      const status = await sound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        await sound.playAsync();
      }

    } catch (error) {
      console.error('[Gemini Realtime] ❌ Error in queue playback:', error);
      this.playNextInQueue(); // Continua con il prossimo
    }
  }

  private async stopAllAudio(): Promise<void> {
    console.log('[Gemini Realtime] 🛑 Stopping all audio...');
    
    // ✅ Ferma tutti i chunk in coda
    for (const sound of this.audioQueue) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (error) {
        console.error('[Gemini Realtime] ❌ Error stopping audio:', error);
      }
    }
    
    this.audioQueue = [];
    this.isPlayingAudio = false;
    
    console.log('[Gemini Realtime] ✅ All audio stopped');
  }

  public disconnect(): void {
    try {
      console.log('[Gemini Realtime] 🔌 Disconnecting...');
      
      if (this.isRecording) {
        this.stopAudioRecording();
      }
      
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      if (this.audioAnalyser) {
        this.audioAnalyser.destroy();
      }
      
      this.isConnected = false;
      this.options = null;
      
      console.log('[Gemini Realtime] ✅ Disconnected successfully');

    } catch (error) {
      console.error('[Gemini Realtime] ❌ Error during disconnect:', error);
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  public getRecordingStatus(): boolean {
    return this.isRecording;
  }
}

export default GeminiRealtimeService;
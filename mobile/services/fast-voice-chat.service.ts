import { Audio } from 'expo-av';
import { getBackendURL } from '../constants/env';

export interface FastChatMessage {
  type: 'text' | 'audio' | 'audio_chunk' | 'complete' | 'error';
  chunk?: string;
  audio?: string;
  mimeType?: string;
  chunkNum?: number;
  isStreaming?: boolean;
  response?: string;
  timings?: {
    total: number;
    gemini: number;
  };
  error?: string;
}

export class FastVoiceChatService {
  private currentSound: Audio.Sound | null = null;
  private audioChunksBuffer: string[] = [];
  private isPlayingChunks: boolean = false;
  private isReceivingChunks: boolean = false;
  private audioQueue: Audio.Sound[] = [];
  private audioPlaybackQueue: string[] = []; // Coda di batch base64 da riprodurre
  private isPlayingAudio: boolean = false; // Indica se playback è in corso
  private currentXhr: XMLHttpRequest | null = null; // per abortire lo stream

  /**
   * Send message and stream response using optimized fast endpoint
   * Yields both text chunks and audio as they arrive
   */
  async *streamChatResponse(
    message: string,
    userContext?: any,
    includeAudio: boolean = true,
    emotionContext?: any,
    skinContext?: any,
    analysisIntent?: any
  ): AsyncGenerator<FastChatMessage> {
    const startTime = Date.now();

    this.audioChunksBuffer = [];
    this.audioPlaybackQueue = [];
    this.isPlayingChunks = false;
    this.isPlayingAudio = false;
    this.isReceivingChunks = true;

    try {
      console.log('[FastVoiceChat] 🚀 Starting fast stream with MANUAL XMLHttpRequest SSE');
      console.log('[FastVoiceChat] 📝 Message:', message.substring(0, 50) + '...');

      const backendURL = await getBackendURL();
      console.log('[FastVoiceChat] 🌐 Backend URL:', backendURL);

      // Queue per raccogliere gli eventi SSE
      const eventQueue: FastChatMessage[] = [];
      let streamDone = false;
      let streamError: Error | null = null;
      let hasReceivedData = false;

      // ✅ PARSER SSE MANUALE con XMLHttpRequest (funziona SEMPRE su RN!)
      const xhr = new XMLHttpRequest();
      this.currentXhr = xhr;
      let lastIndex = 0;

      xhr.open('POST', `${backendURL}/api/chat/fast`, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');

      // ✅ POLLING ATTIVO: Leggi responseText ogni 50ms (più affidabile di onprogress)
      const parseResponseText = () => {
        if (xhr.readyState >= 3) { // LOADING o DONE
          const responseText = xhr.responseText;
          if (responseText.length > lastIndex) {
            hasReceivedData = true;
            const newData = responseText.substring(lastIndex);
            lastIndex = responseText.length;

            // Parsing SSE: ogni evento è "data: {...}\n\n"
            const lines = newData.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.substring(6); // Rimuovi "data: "
                  const data = JSON.parse(jsonStr) as FastChatMessage;

                  // Log ridotto
                  if (data.type === 'audio_chunk') {
                    if (this.audioChunksBuffer.length % 10 === 0) {
                      console.log('[FastVoiceChat] 📨 Audio chunks buffered:', this.audioChunksBuffer.length + 1);
                    }
                  } else {
                    console.log('[FastVoiceChat] 📨 Event:', data.type);
                  }

                  eventQueue.push(data);

                  // Gestisci audio chunks (MICRO-BATCH)
                  if (data.type === 'audio_chunk' && data.chunk) {
                    this.audioChunksBuffer.push(data.chunk);
                    
                    // ⚡ Avvia playback dopo 1° chunk (minima latenza!)
                    if (this.audioChunksBuffer.length === 1 && !this.isPlayingChunks) {
                      this.playBufferedAudioChunks();
                    }
                  }

                  // Gestisci evento complete
                  if (data.type === 'complete') {
                    console.log('[FastVoiceChat] ✅ Stream complete');
                    this.isReceivingChunks = false;
                    streamDone = true;
                  }
                } catch (parseError) {
                  // Ignora errori di parsing (chunk incompleto)
                }
              }
            }
          }
        }
      };

      // Polling ogni 50ms per leggere nuovi dati
      const pollingInterval = setInterval(parseResponseText, 50);

      xhr.onload = () => {
        clearInterval(pollingInterval);
        parseResponseText(); // Ultima lettura
        console.log('[FastVoiceChat] 🔌 XHR completed');
        this.isReceivingChunks = false;
        streamDone = true;
        this.currentXhr = null;
      };

      xhr.onerror = (error) => {
        clearInterval(pollingInterval);
        console.error('[FastVoiceChat] ❌ XHR error:', error);
        streamError = new Error('Network request failed');
        this.isReceivingChunks = false;
        streamDone = true;
        this.currentXhr = null;
      };

      xhr.ontimeout = () => {
        clearInterval(pollingInterval);
        console.error('[FastVoiceChat] ⏱️ XHR timeout');
        streamError = new Error('Request timeout');
        this.isReceivingChunks = false;
        streamDone = true;
        this.currentXhr = null;
      };

      xhr.onabort = () => {
        clearInterval(pollingInterval);
        console.log('[FastVoiceChat] 🔌 XHR aborted by client');
        this.isReceivingChunks = false;
        streamDone = true;
        this.currentXhr = null;
      };

      // Avvia la richiesta
      xhr.send(JSON.stringify({
        message,
        userContext,
        includeAudio,
        emotionContext,
        skinContext,
        analysisIntent,
      }));

      // Yield gli eventi man mano che arrivano
      while (!streamDone || eventQueue.length > 0) {
        if (eventQueue.length > 0) {
          const event = eventQueue.shift();
          if (event) {
            yield event;
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      if (streamError) {
        throw streamError;
      }

      this.isReceivingChunks = false;
      const totalTime = Date.now() - startTime;
      console.log('[FastVoiceChat] ✅ Stream complete:', totalTime, 'ms');

    } catch (error) {
      console.error('[FastVoiceChat] ❌ Error:', error);
      this.isReceivingChunks = false;
      yield {
        type: 'error',
        error: String(error),
      };
    }
  }

  /**
   * Leggi stream usando ReadableStream.getReader() (funziona su iOS/Web)
   */
  private async _streamUsingReader(body: any, addEvent: (e: FastChatMessage) => void): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              this._handleStreamEvent(data, addEvent);
            } catch (e) {
              console.log('[FastVoiceChat] ⚠️ Failed to parse SSE line:', line.substring(0, 50));
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Leggi stream usando response.text() (fallback per React Native Android)
   */
  private async _streamUsingText(response: Response, addEvent: (e: FastChatMessage) => void): Promise<void> {
    const fullText = await response.text();
    console.log('[FastVoiceChat] 📊 Received', fullText.length, 'chars');

    const lines = fullText.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          this._handleStreamEvent(data, addEvent);
        } catch (e) {
          console.log('[FastVoiceChat] ⚠️ Failed to parse SSE line');
        }
      }
    }
  }

  /**
   * Processa un singolo evento SSE
   */
  private _handleStreamEvent(data: any, addEvent: (e: FastChatMessage) => void): void {
    if (data.type === 'text') {
      console.log('[FastVoiceChat] 📝 Text chunk:', data.response?.substring(0, 40));
      addEvent({
        type: 'text',
        response: data.response,
      });
    } else if (data.type === 'audio_chunk' && data.chunk) {
      console.log('[FastVoiceChat] 🎵 Audio chunk received');
      this.audioChunksBuffer.push(data.chunk);
      
      if (this.audioChunksBuffer.length === 1 && !this.isPlayingChunks) {
        this.playBufferedAudioChunks();
      }
      
      addEvent({
        type: 'audio_chunk',
        chunk: data.chunk,
      });
    } else if (data.type === 'audio' && data.audio) {
      console.log('[FastVoiceChat] 🎵 Full audio received');
      addEvent({
        type: 'audio',
        audio: data.audio,
      });
      this.playAudioBase64(data.audio);
    } else if (data.type === 'complete') {
      console.log('[FastVoiceChat] ✅ Stream complete signal received');
      this.isReceivingChunks = false;
      addEvent({
        type: 'complete',
      });
    } else if (data.type === 'error') {
      console.error('[FastVoiceChat] ❌ Server error:', data.error);
      addEvent({
        type: 'error',
        error: data.error,
      });
    }
  }

  /**
   * Pulisce una stringa base64 rimuovendo solo caratteri non validi
   * (Whitespace, newlines, etc. - NON padding, ora gestito correttamente dal backend)
   */
  private cleanBase64(base64: string): string {
    // Rimuovi solo whitespace/newlines, mantieni tutto il resto (incluso padding)
    return base64.replace(/\s/g, '');
  }

  /**
   * Play buffered audio chunks progressively with QUEUE-BASED playback
   * NON BLOCCANTE: Raccoglie chunks in background mentre riceve stream
   */
  private async playBufferedAudioChunks(): Promise<void> {
    if (this.isPlayingChunks) {
      console.log('[FastVoiceChat] ⚠️ Audio playback already running');
      return;
    }

    this.isPlayingChunks = true;
    console.log('[FastVoiceChat] 🎵 Starting micro-batch audio streaming (queue-based)');

    try {
      let batchCount = 0;
      let lastChunkTime = Date.now();
      const IDLE_TIMEOUT = 3000; // 3 secondi di inattività = stream finito

      // Loop continuo: controlla se hay chunks, ma NON aspetta playback (è async)
      while (true) {
        // Se ci sono chunks disponibili, mettili in coda per playback
        if (this.audioChunksBuffer.length > 0) {
          lastChunkTime = Date.now(); // Resetta timeout

          // Prendi TUTTI i chunks disponibili ADESSO (micro-batch)
          const currentBatch = this.audioChunksBuffer.splice(0);

          batchCount++;
          console.log(
            '[FastVoiceChat] 🎵 Queued micro-batch #' +
              batchCount +
              ', chunks: ' +
              currentBatch.length
          );

          // ✅ CRITICAL: Enqueue each base64 chunk INDIVIDUALLY to preserve validity
          // Concatenating base64 strings corrupts intermediate padding → invalid data URI
          for (const chunk of currentBatch) {
            this.audioPlaybackQueue.push(chunk);
          }
          
          // Avvia playback se non sta già riproducendo
          if (!this.isPlayingAudio) {
            this.processAudioQueue();
          }
        } else {
          // Nessun chunk disponibile al momento
          const timeSinceLastChunk = Date.now() - lastChunkTime;
          
          // Se abbiamo ricevuto dati E sono > 3s senza nuovi chunk E non stiamo ricevendo -> termina
          if (!this.isReceivingChunks && timeSinceLastChunk > IDLE_TIMEOUT && batchCount > 0) {
            console.log('[FastVoiceChat] ✅ Audio buffer empty, no new chunks for ' + timeSinceLastChunk + 'ms, receiving stopped');
            break;
          }
          
          // Aspetta un po' prima di ricontrollare
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Aspetta che la coda di playback sia completata
      console.log('[FastVoiceChat] ⏳ Waiting for playback queue to finish (' + this.audioPlaybackQueue.length + ' batches pending)...');
      while (this.isPlayingAudio || this.audioPlaybackQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.isPlayingChunks = false;
      console.log('[FastVoiceChat] ✅ Micro-batch audio streaming complete!');
      
    } catch (error) {
      console.error('[FastVoiceChat] ⚠️ Error in micro-batch streaming:', error);
      this.isPlayingChunks = false;
      this.audioChunksBuffer = [];
      this.audioPlaybackQueue = [];
      this.isPlayingAudio = false;
    }
  }

  /**
   * Processa la coda di playback in modo asincrono (NON BLOCCANTE)
   */
  private async processAudioQueue(): Promise<void> {
    if (this.isPlayingAudio) {
      return; // Già in corso
    }

    this.isPlayingAudio = true;

    try {
      while (this.audioPlaybackQueue.length > 0) {
        const batchAudio = this.audioPlaybackQueue.shift();
        if (batchAudio) {
          console.log('[FastVoiceChat] 🎵 Playing batch from queue, remaining:', this.audioPlaybackQueue.length);
          await this.playAudioBase64(batchAudio);
          console.log('[FastVoiceChat] ✅ Batch played');
        }
      }
    } finally {
      this.isPlayingAudio = false;
      console.log('[FastVoiceChat] ✅ Playback queue exhausted');
    }
  }

  /**
   * Play audio from base64 string
   */
  private async playAudioBase64(audioBase64: string): Promise<void> {
    try {
      // Stop any currently playing audio
      if (this.currentSound) {
        await this.currentSound.unloadAsync();
        this.currentSound = null;
      }

      // ✅ PULIZIA: rimuovi solo whitespace (il backend ora invia chunk validi >= 4KB)
      const cleanedBase64 = this.cleanBase64(audioBase64);

      const audioUri = `data:audio/mpeg;base64,${cleanedBase64}`;

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 }
      );

      this.currentSound = sound;

      // Wait for playback to complete
      return new Promise((resolve) => {
        let settled = false;
        const settle = async () => {
          if (settled) return;
          settled = true;
          try {
            await sound.unloadAsync();
          } catch {}
          this.currentSound = null;
          resolve();
        };

        // Safety timeout per batch (prevents hangs if didJustFinish never fires)
        const SAFETY_TIMEOUT_MS = 10000;
        const timeoutId = setTimeout(() => {
          console.warn('[FastVoiceChat] ⏱️ Batch playback timeout, forcing resolve');
          settle();
        }, SAFETY_TIMEOUT_MS);

        sound.setOnPlaybackStatusUpdate((status) => {
          // Type guard + multiple end conditions
          // @ts-ignore - runtime check
          const isLoaded = status && status.isLoaded;
          // @ts-ignore - runtime check
          const didJustFinish = isLoaded && status.didJustFinish === true;
          // @ts-ignore - runtime check
          const pos = isLoaded ? (status.positionMillis ?? 0) : 0;
          // @ts-ignore - runtime check
          const dur = isLoaded ? (status.durationMillis ?? 0) : 0;
          const nearEnd = isLoaded && dur > 0 && pos >= Math.max(0, dur - 50);
          // @ts-ignore - runtime check
          const notPlaying = isLoaded && status.isPlaying === false && nearEnd;

          if (didJustFinish || nearEnd || notPlaying) {
            clearTimeout(timeoutId);
            settle();
          }
        });
      });

    } catch (error) {
      console.error('[FastVoiceChat] ⚠️ Audio playback error:', error);
    }
  }

  /**
   * Stop current audio playback
   */
  async stop(): Promise<void> {
    // Interrompi subito lo stream di rete
    if (this.currentXhr) {
      try {
        this.currentXhr.abort();
        console.log('[FastVoiceChat] 🔌 XHR aborted');
      } catch {}
      this.currentXhr = null;
    }
    // Ferma playback
    if (this.currentSound) {
      try {
        await this.currentSound.unloadAsync();
        this.currentSound = null;
        console.log('[FastVoiceChat] ⏹️ Audio stopped');
      } catch (error) {
        console.error('[FastVoiceChat] ⚠️ Error stopping audio:', error);
      }
    }

    // Resetta buffer chunks e flags
    this.isPlayingChunks = false;
    this.isReceivingChunks = false;
    this.audioChunksBuffer = [];
    this.audioPlaybackQueue = [];
    this.isPlayingAudio = false;
    console.log('[FastVoiceChat] 🧹 Audio chunks buffer cleared');
  }

  /**
   * Collect full response from stream
   */
  async collectFullResponse(
    message: string,
    userContext?: any,
    includeAudio: boolean = true,
    emotionContext?: any,
    skinContext?: any,
    analysisIntent?: any
  ): Promise<{ text: string; timings?: any; error?: string }> {
    let fullText = '';
    let timings = {};
    let error = undefined;

    for await (const chunk of this.streamChatResponse(message, userContext, includeAudio, emotionContext, skinContext, analysisIntent)) {
      if (chunk.type === 'text' && chunk.response) {
        fullText += chunk.response;
      } else if (chunk.type === 'complete') {
        timings = chunk.timings || {};
      } else if (chunk.type === 'error') {
        error = chunk.error;
      }
    }

    return { text: fullText, timings, error };
  }
}

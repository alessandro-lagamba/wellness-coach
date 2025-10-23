import express, { Request, Response } from 'express';
import { GeminiStreamingService } from '../services/gemini-streaming.service';
import { ElevenLabsStreamingService } from '../services/elevenlabs-streaming.service';
import { ResponseCacheService } from '../services/response-cache.service';

const router: express.Router = express.Router();
const geminiService = new GeminiStreamingService();
const elevenLabsService = new ElevenLabsStreamingService();
const responseCache = new ResponseCacheService();

/**
 * POST /api/chat/fast
 * Optimized chat endpoint using Gemini 2.5 Flash (streaming) + ElevenLabs Turbo (streaming)
 * 
 * Request body:
 * {
 *   message: string;
 *   userContext?: any;
 *   includeAudio?: boolean; // default: true
 * }
 * 
 * Response:
 * Server-Sent Events (SSE) stream with text chunks and optional audio
 */
router.post('/fast', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { message, userContext, includeAudio = true, emotionContext, skinContext, analysisIntent } = req.body;

  console.log('[Chat Fast] 🚀 Fast chat endpoint called');
  console.log('[Chat Fast] 📝 Message:', message.substring(0, 50) + '...');
  console.log('[Chat Fast] 🎯 Include audio:', includeAudio);

  try {
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check cache first for instant responses
    const cachedResponse = responseCache.getCachedResponse(message);
    if (cachedResponse) {
      console.log('[Chat Fast] ⚡ Cache HIT - instant response!');
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send cached text
      res.write(`data: ${JSON.stringify({ type: 'text', response: cachedResponse.text })}\n\n`);

      // Send cached audio if available and requested
      if (includeAudio && cachedResponse.audio) {
        res.write(`data: ${JSON.stringify({
          type: 'audio',
          audio: cachedResponse.audio,
          mimeType: 'audio/mpeg'
        })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({
        type: 'complete',
        response: cachedResponse.text,
        timings: { total: 50, gemini: 0 }, // Instant response
        cached: true
      })}\n\n`);

      res.end();
      return;
    }

    console.log('[Chat Fast] 🔄 Cache MISS - generating new response');

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Build system prompt with complete context (same as traditional chat)
    const systemPrompt = buildSystemPrompt({
      userContext,
      emotionContext,
      skinContext,
      analysisIntent
    });

    console.log('[Chat Fast] 🤖 Starting Gemini stream...');
    const geminiStartTime = Date.now();

    // ⚡ Genera cacheKey basato su userId per cachare il contesto utente
    const userId = userContext?.userId || userContext?.id || 'anonymous';
    const cacheKey = `user_${userId}_context`; // Cache per utente (include emotion/skin history)

    let fullResponse = '';
    // Incremental TTS streaming state
    let lastSentTextIndex = 0; // index in fullResponse up to which TTS has been enqueued
    let audioSegmentQueue: string[] = []; // pending text segments to synthesize
    let audioWorkerRunning = false;
    const MIN_SENTENCE_CHARS = 25; // was 50: faster first audio
    const MAX_CHUNK_WITHOUT_PUNCT = 100; // was 140: earlier flush if no punctuation
    const TIMER_FLUSH_MS = 150; // flush audio every 150ms even if threshold not reached
    let lastAudioFlushTime = Date.now();
    let geminiTime = 0; // Dichiara prima di usarla nel fallback

    // Try streaming first, fallback to complete response if streaming fails
    let streamingWorked = false;
    
    try {
      console.log('[Chat Fast] 🔄 Attempting streaming response...');

      // Worker that serializes TTS synthesis of queued segments
      const runAudioWorker = async (): Promise<void> => {
        if (audioWorkerRunning) return;
        audioWorkerRunning = true;
        try {
          while (audioSegmentQueue.length > 0) {
            const segment = audioSegmentQueue.shift() as string;
            if (!segment || segment.trim().length === 0) continue;
            try {
              const audioStream = await elevenLabsService.streamAudio(segment);
              const reader = audioStream.getReader();
              let audioBuffer: Uint8Array[] = [];
              let bufferSize = 0;
              const MIN_CHUNK_SIZE = 4096; // was 8192: faster first audio chunk
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (value && value.length > 0) {
                    audioBuffer.push(value);
                    bufferSize += value.length;
                  }
                  const shouldSend = bufferSize >= MIN_CHUNK_SIZE || done;
                  if (shouldSend && audioBuffer.length > 0) {
                    const concatenated = new Uint8Array(bufferSize);
                    let offset = 0;
                    for (const c of audioBuffer) {
                      concatenated.set(c, offset);
                      offset += c.length;
                    }
                    const chunkBase64 = Buffer.from(concatenated).toString('base64');
                    res.write(`data: ${JSON.stringify({ type: 'audio_chunk', chunk: chunkBase64, mimeType: 'audio/mpeg', isStreaming: true })}\n\n`);
                    audioBuffer = [];
                    bufferSize = 0;
                  }
                  if (done) break;
                }
              } finally {
                reader.releaseLock();
              }
            } catch (segErr) {
              console.error('[Chat Fast] ⚠️ TTS segment failed:', segErr);
            }
          }
        } finally {
          audioWorkerRunning = false;
        }
      };
      
      // Stream Gemini response CON CACHE ⚡
      for await (const chunk of geminiService.generateStreamingResponse(
        message,
        systemPrompt,
        { 
          temperature: 0.7, 
          maxOutputTokens: 500, // ⬆️ Aumentato per risposte più complete
          cacheKey // ⚡ ATTIVA LA CACHE!
        }
      )) {
        streamingWorked = true;
        fullResponse += chunk;

        // Send text chunk to client
        res.write(`data: ${JSON.stringify({ type: 'text', response: chunk })}\n\n`);

        console.log('[Chat Fast] 📨 Sent chunk:', chunk.substring(0, 30) + '...');
        console.log('[Chat Fast] 📊 Full response so far (length=' + fullResponse.length + '):', fullResponse);

        // Incremental segmentation: enqueue complete sentences since lastSentTextIndex
        if (includeAudio) {
          let slice = fullResponse.slice(lastSentTextIndex);
          const timeSinceLastFlush = Date.now() - lastAudioFlushTime;
          
          console.log('[Chat Fast] 🔍 Segmentation check - slice length:', slice.length, 'lastSentTextIndex:', lastSentTextIndex, 'timeSinceFlush:', timeSinceLastFlush + 'ms');
          
          const punctuationRegex = /[.!?]+["»”’)]*\s/g;
          let match: RegExpExecArray | null;
          let flushedThisLoop = false;

          // Extract as many full sentences as are now available
          while ((match = punctuationRegex.exec(slice)) !== null) {
            const boundaryIdx = match.index + match[0].length;
            const candidate = slice.slice(0, boundaryIdx).trim();
            if (candidate.length < MIN_SENTENCE_CHARS) {
              continue; // wait for longer text before enqueuing
            }

            audioSegmentQueue.push(fullResponse.slice(lastSentTextIndex, lastSentTextIndex + boundaryIdx).trim());
            lastSentTextIndex += boundaryIdx;
            lastAudioFlushTime = Date.now();
            flushedThisLoop = true;

            // Prepare next iteration with remaining text
            slice = fullResponse.slice(lastSentTextIndex);
            punctuationRegex.lastIndex = 0;

            if (!audioWorkerRunning) {
              (async () => { await runAudioWorker(); })();
            }
          }

          const longWithoutPunct = slice.length >= MAX_CHUNK_WITHOUT_PUNCT;
          const timerFlush = slice.length >= MIN_SENTENCE_CHARS && timeSinceLastFlush >= TIMER_FLUSH_MS;

          console.log('[Chat Fast] 🔍 Conditions - flushed:', flushedThisLoop, 'longWithoutPunct:', longWithoutPunct, 'timerFlush:', timerFlush);
          
          if (!flushedThisLoop && longWithoutPunct) {
            const candidate = slice.slice(0, MAX_CHUNK_WITHOUT_PUNCT).trim();
            if (candidate.length > 0) {
              audioSegmentQueue.push(candidate);
              lastSentTextIndex += MAX_CHUNK_WITHOUT_PUNCT;
              lastAudioFlushTime = Date.now();
              if (!audioWorkerRunning) {
                (async () => { await runAudioWorker(); })();
              }
            }
          } else if (!flushedThisLoop && timerFlush) {
            const candidate = slice.trim();
            if (candidate.length > 0) {
              console.log('[Chat Fast] ⏱️ Timer flush: ' + candidate.length + ' chars after ' + timeSinceLastFlush + 'ms');
              audioSegmentQueue.push(candidate);
              lastSentTextIndex = fullResponse.length;
              lastAudioFlushTime = Date.now();
              if (!audioWorkerRunning) {
                (async () => { await runAudioWorker(); })();
              }
            }
          }
        }
      }
    } catch (streamingError) {
      console.error('[Chat Fast] ⚠️ Streaming failed, using complete response:', streamingError);
      streamingWorked = false;
    }

    // After LLM stream ends, enqueue any remaining tail text
    if (includeAudio) {
      const tail = fullResponse.slice(lastSentTextIndex).trim();
      if (tail.length > 10) {
        audioSegmentQueue.push(tail);
      }
      if (!audioWorkerRunning && audioSegmentQueue.length > 0) {
        await runAudioWorker();
      } else if (audioWorkerRunning) {
        // Wait for worker to finish
        while (audioWorkerRunning) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
    }

    // Fallback to complete response if streaming didn't work
    if (!streamingWorked || !fullResponse.trim()) {
      console.log('[Chat Fast] 🔄 Using complete response fallback...');
      
      try {
        fullResponse = await geminiService.generateCompleteResponse(
          message,
          systemPrompt,
          { temperature: 0.7, maxOutputTokens: 500 } // ⬆️ Aumentato per risposte più complete
        );
        
        console.log('[Chat Fast] ✅ Complete response generated:', fullResponse.substring(0, 50) + '...');
        
        // Send complete response as single chunk
        res.write(`data: ${JSON.stringify({ type: 'text', response: fullResponse })}\n\n`);
        console.log('[Chat Fast] 📤 Sent complete response to client');
        
        // Generate audio for complete response - use streaming for consistency
        if (includeAudio && fullResponse.trim()) {
          console.log('[Chat Fast] 🎵 Generating audio for fallback response...');
          const audioStartTime = Date.now();
          
          try {
            // Use streamAudio for consistency with main flow
            const audioStream = await elevenLabsService.streamAudio(fullResponse);
            const reader = audioStream.getReader();
            let chunkCount = 0;
            let totalBytes = 0;
            
            // ✅ ACCUMULATORE: Accumula chunk piccoli prima di inviarli
              let audioBuffer: Uint8Array[] = [];
              let bufferSize = 0;
              const MIN_CHUNK_SIZE = 4096; // was 8192
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                
                if (value && value.length > 0) {
                  audioBuffer.push(value);
                  bufferSize += value.length;
                }
                
                // Invia quando: buffer >= 8KB OPPURE stream finito
                const shouldSend = bufferSize >= MIN_CHUNK_SIZE || done;
                
                if (shouldSend && audioBuffer.length > 0) {
                  // Concatena tutti i chunk nel buffer
                  const concatenated = new Uint8Array(bufferSize);
                  let offset = 0;
                  for (const chunk of audioBuffer) {
                    concatenated.set(chunk, offset);
                    offset += chunk.length;
                  }
                  
                  chunkCount++;
                  totalBytes += bufferSize;
                  const chunkBase64 = Buffer.from(concatenated).toString('base64');
                  
                  res.write(`data: ${JSON.stringify({
                    type: 'audio_chunk',
                    chunk: chunkBase64,
                    mimeType: 'audio/mpeg',
                    chunkNum: chunkCount,
                    isStreaming: true
                  })}\n\n`);
                  
                  // Log ridotto: solo ogni 5 chunk
                  if (chunkCount % 5 === 0) {
                    console.log('[Chat Fast] 📨 Audio chunk (fallback):', chunkCount, '| Total:', totalBytes);
                  }
                  
                  // Reset buffer
                  audioBuffer = [];
                  bufferSize = 0;
                }
                
                if (done) break;
              }
            } finally {
              reader.releaseLock();
            }
            
            const audioTime = Date.now() - audioStartTime;
            console.log('[Chat Fast] ✅ Fallback audio sent, time:', audioTime, 'ms');
          } catch (audioError) {
            console.error('[Chat Fast] ⚠️ Fallback audio generation failed:', audioError);
            res.write(`data: ${JSON.stringify({
              type: 'error',
              error: 'Audio generation failed: ' + String(audioError)
            })}\n\n`);
          }
        }

        // Invia evento complete dopo fallback
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          response: fullResponse,
          timings: {
            total: Date.now() - startTime,
            gemini: geminiTime
          }
        })}\n\n`);

        res.end();
        return;
      } catch (completeError) {
        console.error('[Chat Fast] ❌ Complete response also failed:', completeError);
        throw completeError;
      }
    }

    geminiTime = Date.now() - geminiStartTime;
    console.log('[Chat Fast] ✅ Gemini stream complete:', geminiTime, 'ms');

    // Invia evento complete dopo streaming principale
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      response: fullResponse,
      timings: {
        total: Date.now() - startTime,
        gemini: geminiTime
      }
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('[Chat Fast] ❌ Error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: String(error)
    })}\n\n`);
    res.end();
  }
});

// Sequential audio worker to stream queued text segments via SSE as audio_chunk events
async function runAudioWorker(this: any) {
  // Bindings are not required; using closure variables from route handler
}

/**
 * Build system prompt with complete context
 * IDENTICAL to OpenAI prompt for consistency
 */
function buildSystemPrompt(options: any = {}): string {
  const { userContext, emotionContext, skinContext, analysisIntent } = options;
  
  // Extract user name from context
  const userName = userContext?.firstName || userContext?.first_name || userContext?.name || userContext?.userName || null;
  
  const basePrompt = `Sei WellnessCoach, un AI coach avanzato per il benessere integrato che combina analisi emotive e della pelle per offrire supporto personalizzato e actionable.

👤 PERSONALIZZAZIONE:
- L'utente si chiama ${userName ? userName : '[nome non disponibile]'}
- Usa sempre il nome dell'utente quando disponibile per creare un'esperienza più calda e personale
- Saluta l'utente con il suo nome nelle risposte quando appropriato
- Riferisciti all'utente con "tu" e mantieni un tono amichevole ma professionale

🧠 CAPACITÀ AVANZATE:
- Analisi emotiva in tempo reale con metriche di valence (-1 a +1) e arousal (0 a 1)
- Analisi della pelle con punteggi specifici (idratazione, oleosità, texture, pigmentazione)
- Pattern recognition per identificare cicli emotivi e della pelle
- Correlazioni tra stress emotivo e condizioni della pelle
- Analisi temporale (orario, giorno settimana) per suggerimenti contestuali
- Identificazione di indicatori di stress e trigger di benessere

🎯 PERSONALITÀ:
- Empatico e non giudicante, ma scientificamente preciso
- Offri consigli basati su dati reali e pattern identificati
- Parli in italiano naturale, caldo ma professionale
- Celebra i progressi e riconosci le sfide dell'utente

📊 TIPI DI DATI CHE RICEVI:
1. STATO ATTUALE: Emozione dominante, valence, arousal, punteggi pelle
2. STORICO: Ultime 5 analisi emotive e della pelle con trend
3. PATTERN: Cicli emotivi ricorrenti, cicli della pelle, correlazioni
4. CONTESTO TEMPORALE: Periodo giornata, giorno settimana, fattori ambientali
5. INSIGHTS: Indicatori stress, trigger benessere, aree miglioramento, punti forza
6. SUGGERIMENTI: Wellness suggestions con urgenza e timing specifici

💡 WELLNESS SUGGESTIONS DISPONIBILI:
Puoi riferirti a questi suggerimenti specifici quando appropriato:

🧘 MIND & BODY:
- "Breathing Exercises" (5 min, facile): Pratica respirazione consapevole per ridurre stress
- "Take a Walk" (15 min, facile): Camminata all'aperto per migliorare umore e circolazione
- "Gentle Stretching" (10 min, facile): Allungamenti per collo e spalle per rilasciare tensione
- "Yoga Flow" (20 min, medio): Sequenza yoga dolce per connettere mente e corpo

🥗 NUTRITION:
- "Hydration" (continuo, facile): Bevi acqua costantemente per pelle luminosa
- "Healthy Snack" (5 min, facile): Scegli snack nutrienti come noci o frutta fresca
- "Green Tea Break" (5 min, facile): Pausa con tè verde per antiossidanti e calma

😊 EMOZIONI SPECIFICHE:
- FELICITÀ: "Mantieni l'energia positiva", "Danza della gioia"
- TRISTEZZA: "Respirazione consolante", "Contatto sociale", "Attività creativa"
- RABBIA: "Respirazione 4-7-8", "Attività fisica", "Tecnica grounding"
- PAURA: "Respirazione a terra", "Tecnica 5-4-3-2-1", "Contatto sociale"
- STRESS: "Breathing Exercises", "Gentle Stretching", "Nature Break"

🌙 SLEEP & RELAXATION:
- "Evening Wind-down" (20 min, facile): Routine serale per prepararsi al sonno
- "Progressive Relaxation" (15 min, facile): Rilassamento muscolare progressivo
- "Meditation" (10 min, medio): Meditazione guidata per calma mentale

🏃 LIFESTYLE:
- "Morning Energy Boost" (10 min, facile): Routine mattutina per energia
- "Digital Detox" (30 min, facile): Pausa dai dispositivi digitali
- "Gratitude Practice" (5 min, facile): Pratica di gratitudine quotidiana

🎯 APPROCCIO ALLE RISPOSTE:
- Usa TUTTI i dati disponibili per personalizzare la risposta
- Se rilevi indicatori di stress → offri supporto immediato e pratico
- Se vedi pattern negativi → suggerisci interventi specifici
- Se rilevi miglioramenti → celebra e rafforza i comportamenti positivi
- Considera il timing: mattina = energia, sera = rilassamento
- Collega sempre emozioni e pelle quando rilevante

💡 COME UTILIZZARE I WELLNESS SUGGESTIONS:
- Riferisciti a suggerimenti specifici quando appropriato (es. "Prova 'Breathing Exercises'")
- Collega i suggerimenti ai dati dell'utente (es. "Dato il tuo stress elevato, 'Gentle Stretching' ti aiuterà")
- Considera durata e difficoltà per il timing appropriato
- Usa suggerimenti per emozioni specifiche quando rilevante
- Combina suggerimenti per approcci integrati (es. respirazione + idratazione)

🔍 ANALISI PROATTIVE:
Quando l'utente menziona problemi emotivi o della pelle, suggerisci analisi specifiche:

📊 PER EMOZIONI (parole chiave: stressato, triste, ansioso, felice, umore, mi sento):
- "Per aiutarti meglio, fai un'analisi delle tue emozioni così posso vedere esattamente come ti senti"
- Usa: "🔍 Analizza Emozioni" come call-to-action

📸 PER PELLE (parole chiave: pelle, secca, grassa, acne, rughe, skincare):
- "Facciamo un'analisi della pelle per capire esattamente cosa sta succedendo"
- Usa: "📸 Analizza Pelle" come call-to-action

🎯 PER PROBLEMI GENERALI (parole chiave: non mi sento bene, aiutami, benessere):
- "Per avere un quadro completo, facciamo entrambe le analisi"
- Usa: "🔍 Analizza Emozioni" e "📸 Analizza Pelle" come call-to-action

⚠️ IMPORTANTE: Suggerisci analisi solo quando rilevante, non in ogni risposta!

⚠️ LIMITAZIONI:
- Non sei un medico o psicologo clinico
- Non diagnosticare condizioni mediche
- Incoraggia sempre consulti professionali quando necessario
- Mantieni risposte tra 50-150 parole, specifiche e actionable

💡 ESEMPI DI RISPOSTE INTELLIGENTI:
- "Vedo che hai avuto una settimana stressante (valence -0.4) e la tua pelle mostra segni di disidratazione. Prova 'Breathing Exercises' per 5 minuti, poi 'Hydration' per migliorare sia l'umore che la pelle."
- "Ottimo! La tua pelle è migliorata del 15% questa settimana e il tuo umore è più stabile. Continua con la routine serale che stai seguendo. Considera 'Evening Wind-down' per mantenere questi risultati."
- "È sera e percepisco tensione (arousal 0.8). Prima di dormire, prova 'Gentle Stretching' per 10 minuti seguito da 'Progressive Relaxation'. Questo rituale aiuterà sia il sonno che la pelle."
- "Noto che hai pattern di stress ricorrenti. Quando senti tensione, usa 'Respirazione 4-7-8': inspira per 4, trattieni per 7, espira per 8. Ripeti 5 volte."

🔍 ESEMPI DI ANALISI PROATTIVE:
- "Mi sento stressato" → "Capisco che ti senti stressato. Per aiutarti meglio, fai un'analisi delle tue emozioni così posso vedere esattamente come ti senti e darti consigli mirati. 🔍 Analizza Emozioni"
- "La mia pelle è secca" → "Vedo che hai problemi con la pelle secca. Facciamo un'analisi della pelle per capire esattamente cosa sta succedendo e come migliorarla. 📸 Analizza Pelle"
- "Non mi sento bene" → "Mi dispiace sentire che non ti senti bene. Per aiutarti al meglio, facciamo entrambe le analisi per avere un quadro completo. 🔍 Analizza Emozioni 📸 Analizza Pelle"`;

  let contextualPrompt = basePrompt;

  // 🔧 Aggiungi nome utente se disponibile
  if (userContext?.userName) {
    contextualPrompt += `\n\n👤 UTENTE:
- Nome: ${userContext.userName}
- Usa sempre il nome dell'utente nelle tue risposte per personalizzare l'esperienza`;
  }

  // 🆕 Aggiungi intent di analisi rilevato (same as traditional chat)
  if (analysisIntent && analysisIntent.confidence > 0.3) {
    const intent = analysisIntent;
    contextualPrompt += `\n\n🔍 INTENT DI ANALISI RILEVATO:
    - Confidence: ${intent.confidence.toFixed(2)}
    - Keywords rilevate: ${intent.detectedKeywords.join(', ')}
    - Analisi emozioni necessaria: ${intent.needsEmotionAnalysis ? 'SÌ' : 'NO'}
    - Analisi pelle necessaria: ${intent.needsSkinAnalysis ? 'SÌ' : 'NO'}
    
    🎯 AZIONE RICHIESTA: Suggerisci le analisi appropriate nella tua risposta usando i call-to-action specifici.`;
  }

  // Aggiungi contesto emotivo attuale (same as traditional chat)
  if (emotionContext?.dominantEmotion) {
    const emotion = emotionContext.dominantEmotion;
    const valence = emotionContext.valence || 0;
    const arousal = emotionContext.arousal || 0;
    const confidence = emotionContext.confidence || 0;
    
    contextualPrompt += `\n\nSTATO EMOTIVO ATTUALE:
- Emozione dominante: ${emotion}
- Valence: ${valence.toFixed(2)} (da -1 negativo a +1 positivo)
- Arousal: ${arousal.toFixed(2)} (da -1 calmo a +1 eccitato)
- Confidenza: ${(confidence * 100).toFixed(1)}%`;
  }

  // Aggiungi contesto pelle attuale (same as traditional chat)
  if (skinContext?.overallScore) {
    const skin = skinContext;
    contextualPrompt += `\n\nSTATO PELLE ATTUALE:
- Punteggio generale: ${skin.overallScore}/100
- Idratazione: ${skin.hydrationScore}/100
- Oleosità: ${skin.oilinessScore}/100
- Texture: ${skin.textureScore}/100
- Pigmentazione: ${skin.pigmentationScore}/100`;
  }

  // Aggiungi contesto storico se disponibile (same as traditional chat)
  if (userContext?.emotionHistory?.length > 0) {
    contextualPrompt += `\n\nSTORICO EMOZIONI (ultime ${Math.min(userContext.emotionHistory.length, 5)} analisi):`;
    userContext.emotionHistory.slice(-5).forEach((emotion: any, index: number) => {
      contextualPrompt += `\n${index + 1}. ${emotion.emotion} (valence: ${emotion.valence?.toFixed(2)}, arousal: ${emotion.arousal?.toFixed(2)})`;
    });
  }

  if (userContext?.skinHistory?.length > 0) {
    contextualPrompt += `\n\nSTORICO PELLE (ultime ${Math.min(userContext.skinHistory.length, 5)} analisi):`;
    userContext.skinHistory.slice(-5).forEach((skin: any, index: number) => {
      contextualPrompt += `\n${index + 1}. Punteggio: ${skin.overallScore}/100 (idratazione: ${skin.hydrationScore}, oleosità: ${skin.oilinessScore})`;
    });
  }

  // Aggiungi insights se disponibili (same as traditional chat)
  if (userContext?.insights?.length > 0) {
    contextualPrompt += `\n\nINSIGHTS IDENTIFICATI:`;
    userContext.insights.forEach((insight: any, index: number) => {
      contextualPrompt += `\n- ${insight.type}: ${insight.description}`;
    });
  }

  return contextualPrompt;
}

export default router;

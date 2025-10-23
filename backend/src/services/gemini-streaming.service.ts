import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiStreamOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  cacheKey?: string; // Per identificare univocamente il contesto da cachare (future use)
}

export class GeminiStreamingService {
  private client: GoogleGenerativeAI;
  private model = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not set in environment variables');
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate streaming response using Gemini 2.5 Flash
   * Returns chunks as they are generated for faster perceived latency
   */
  async *generateStreamingResponse(
    message: string,
    systemPrompt: string,
    options: GeminiStreamOptions = {}
  ): AsyncGenerator<string> {
    try {
      const {
        temperature = 0.7,
        maxOutputTokens = 500,
        topP = 0.95,
        cacheKey // Parametro mantenuto per compatibilità futura
      } = options;

      console.log('[Gemini Streaming] 🚀 Starting stream with model:', this.model);
      console.log('[Gemini Streaming] 📝 Message length:', message.length);
      console.log('[Gemini Streaming] ⏱️ Timestamp:', new Date().toISOString());

      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt,
      });

      const startTime = Date.now();
      let totalChunks = 0;
      let totalTokens = 0;

      const stream = await model.generateContentStream({
        contents: [
          {
            role: 'user',
            parts: [{ text: message }]
          }
        ],
        generationConfig: {
          temperature: temperature, // Usa parametro passato
          maxOutputTokens: maxOutputTokens, // Usa parametro passato
          topP: topP, // Usa parametro passato
          candidateCount: 1,
          stopSequences: [],
        }
      });

      console.log('[Gemini Streaming] ✅ Stream initiated');

      for await (const chunk of stream.stream) {
        try {
          console.log('[Gemini Streaming] 🔍 Raw chunk received:', {
            hasChunk: !!chunk,
            chunkType: typeof chunk,
            chunkKeys: chunk ? Object.keys(chunk) : [],
            hasTextFunction: chunk && typeof chunk.text === 'function'
          });

          // Gemini SDK returns text directly on the chunk
          // chunk has a text property that's a function
          if (chunk && typeof chunk.text === 'function') {
            const text = chunk.text();
            console.log('[Gemini Streaming] 📝 Extracted text:', {
              text: text ? text.substring(0, 50) + '...' : 'null',
              textLength: text ? text.length : 0,
              isTrimmed: text ? text.trim().length > 0 : false
            });
            
            if (text && text.trim()) {
              totalChunks++;
              totalTokens += text.split(/\s+/).length;
              
              if (totalChunks === 1) {
                const ttfb = Date.now() - startTime;
                console.log('[Gemini Streaming] ⚡ Time to first byte (TTFB):', ttfb, 'ms');
              }

              console.log('[Gemini Streaming] ✅ Yielding text chunk:', text.substring(0, 30) + '...');
              yield text;
            } else {
              console.log('[Gemini Streaming] ⚠️ Empty or whitespace-only text, skipping');
            }
          } else {
            console.log('[Gemini Streaming] ⚠️ Chunk does not have text function or is invalid');
          }
        } catch (chunkError) {
          console.warn('[Gemini Streaming] ⚠️ Error parsing chunk:', chunkError);
          // Continue to next chunk on error
        }
      }

      const totalTime = Date.now() - startTime;
      console.log('[Gemini Streaming] ✅ Stream complete:', {
        totalTime,
        totalChunks,
        estimatedTokens: totalTokens,
        avgChunkSize: totalTokens / totalChunks
      });

    } catch (error) {
      console.error('[Gemini Streaming] ❌ Error:', error);
      throw new Error(`Gemini streaming failed: ${error}`);
    }
  }

  /**
   * Generate complete response (non-streaming fallback)
   */
  async generateCompleteResponse(
    message: string,
    systemPrompt: string,
    options: GeminiStreamOptions = {}
  ): Promise<string> {
    try {
      const {
        temperature = 0.7,
        maxOutputTokens = 500,
        topP = 0.95
      } = options;

      console.log('[Gemini] 🎯 Generating complete response with model:', this.model);

      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: message }]
          }
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
          topP,
          candidateCount: 1,
        }
      });

      const response = await result.response;
      const text = response.text();

      console.log('[Gemini] ✅ Response generated:', {
        length: text.length,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        timestamp: new Date().toISOString()
      });

      // Se la risposta è vuota, genera una risposta di fallback
      if (!text || text.trim().length === 0) {
        console.warn('[Gemini] ⚠️ Empty response, using fallback');
        return "Ciao! Come posso aiutarti oggi?";
      }

      return text;

    } catch (error) {
      console.error('[Gemini] ❌ Error:', error);
      throw new Error(`Gemini generation failed: ${error}`);
    }
  }
}

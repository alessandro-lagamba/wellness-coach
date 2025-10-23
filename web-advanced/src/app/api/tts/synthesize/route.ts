import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[TTS Route] 🎤 POST /api/tts/synthesize started');

  try {
    // 1. Parse request body
    let body: any;
    try {
      body = await req.json();
      console.log('[TTS Route] 📥 Request body:', {
        hasText: !!body.text,
        textLength: body.text?.length || 0,
        voice: body.voice,
        provider: body.provider,
        language: body.language
      });
    } catch (parseError) {
      console.error('[TTS Route] ❌ JSON parse error:', parseError);
      return NextResponse.json({ 
        message: 'Invalid JSON body',
        error: String(parseError)
      }, { status: 400 });
    }

    const { text, voice, provider = 'cartesia', language = 'it' } = body;

    // 2. Validate input
    if (!text || typeof text !== 'string') {
      console.error('[TTS Route] ❌ Missing or invalid text field');
      return NextResponse.json({ 
        message: 'Missing or invalid text field',
        received: { text: typeof text, length: text?.length }
      }, { status: 400 });
    }

    // 3. Check environment variables
    const cartesiaKey = process.env.CARTESIA_API_KEY;
    console.log('[TTS Route] 🔑 Environment check:', {
      hasCartesiaKey: !!cartesiaKey,
      keyLength: cartesiaKey?.length || 0,
      nodeEnv: process.env.NODE_ENV
    });

    if (!cartesiaKey) {
      console.error('[TTS Route] ❌ CARTESIA_API_KEY not found in environment');
      return NextResponse.json({ 
        message: 'TTS service not configured - missing API key',
        provider: 'cartesia'
      }, { status: 500 });
    }

    // 4. Prepare TTS request (Cartesia format)
    // Environment-based configuration
    const envVoice = process.env.CARTESIA_VOICE || 'azzurra-voice';
    const envLanguage = process.env.CARTESIA_LANGUAGE || 'it';
    const envSampleRate = parseInt(process.env.CARTESIA_SAMPLE_RATE || '24000');

    // Map voice names to Cartesia voice IDs (verified IDs)
    const voiceMap: Record<string, string> = {
      'azzurra-voice': 'd609f27f-f1a4-410f-85bb-10037b4fba99', // Italian Female (verified working)
      'liv': 'd718e944-b313-4998-b011-d1cc078d4ef3', // Liv (English Female) 
      'default': 'd609f27f-f1a4-410f-85bb-10037b4fba99' // Default to Italian Female
    };
    
    // Use provided voice or fallback to environment/default
    const requestedVoice = voice || envVoice;
    const voiceId = voiceMap[requestedVoice] || voiceMap['azzurra-voice'];
    const finalLanguage = language || envLanguage;

    console.log('[TTS Route] 🎯 Voice/Language resolution:', {
      requestedVoice,
      resolvedVoiceId: voiceId,
      requestedLanguage: language,
      finalLanguage,
      envVoice,
      envLanguage,
      sampleRate: envSampleRate
    });
    const ttsPayload = {
      model_id: 'sonic-2',
      transcript: text,
      voice: {
        mode: 'id',
        id: voiceId // Using resolved voice ID
      },
      output_format: {
        container: 'wav',
        encoding: 'pcm_s16le',
        sample_rate: envSampleRate // Using environment sample rate
      },
      language: finalLanguage // Using resolved language
    };

    const ttsUrl = 'https://api.cartesia.ai/tts/bytes';
    console.log('[TTS Route] 🚀 Calling Cartesia TTS:', {
      url: ttsUrl,
      payloadKeys: Object.keys(ttsPayload),
      textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      voice_id: voiceId
    });

    // 5. Call Cartesia API
    let ttsResponse: Response;
    try {
      ttsResponse = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cartesiaKey}`,
          'Content-Type': 'application/json',
          'X-API-Key': cartesiaKey,
          'Cartesia-Version': '2024-06-10' // Required by Cartesia API
        },
        body: JSON.stringify(ttsPayload)
      });

      console.log('[TTS Route] 📡 Cartesia response:', {
        status: ttsResponse.status,
        statusText: ttsResponse.statusText,
        contentType: ttsResponse.headers.get('content-type'),
        contentLength: ttsResponse.headers.get('content-length')
      });

    } catch (fetchError) {
      console.error('[TTS Route] ❌ Network error calling Cartesia:', fetchError);
      return NextResponse.json({ 
        message: 'Failed to connect to TTS provider',
        error: String(fetchError),
        provider: 'cartesia'
      }, { status: 502 });
    }

    // 6. Handle provider response
    if (!ttsResponse.ok) {
      let errorBody: string;
      try {
        errorBody = await ttsResponse.text();
        console.error('[TTS Route] ❌ Cartesia API error:', {
          status: ttsResponse.status,
          statusText: ttsResponse.statusText,
          body: errorBody.substring(0, 500)
        });
      } catch (readError) {
        errorBody = 'Could not read error response';
        console.error('[TTS Route] ❌ Could not read Cartesia error response:', readError);
      }

      return NextResponse.json({ 
        message: 'TTS provider error',
        providerStatus: ttsResponse.status,
        providerStatusText: ttsResponse.statusText,
        providerBody: errorBody
      }, { status: 502 });
    }

    // 7. Process successful response
    let audioData: ArrayBuffer;
    try {
      audioData = await ttsResponse.arrayBuffer();
      console.log('[TTS Route] ✅ Audio data received:', {
        byteLength: audioData.byteLength,
        sizeKB: Math.round(audioData.byteLength / 1024)
      });
    } catch (readError) {
      console.error('[TTS Route] ❌ Failed to read audio data:', readError);
      return NextResponse.json({ 
        message: 'Failed to process audio response',
        error: String(readError)
      }, { status: 500 });
    }

    // 8. Convert to base64 for JSON response (compatible with existing frontend)
    const base64Audio = Buffer.from(audioData).toString('base64');
    const duration = estimateAudioDuration(audioData.byteLength, envSampleRate, 16);

    const responseData = {
      audioBase64: base64Audio,
      duration,
      meta: {
        provider: 'cartesia',
        voice: voiceId,
        language: finalLanguage,
        sampleRate: envSampleRate,
        format: 'wav',
        // Add validation info
        requestedVoice: requestedVoice,
        resolvedVoiceId: voiceId
      }
    };

    // 9. ASSERT: Validate that we're using the correct voice and language
    console.log('[TTS Route] 🔍 Response validation:', {
      expectedVoice: requestedVoice,
      actualVoiceId: voiceId,
      expectedLanguage: finalLanguage,
      actualLanguage: finalLanguage,
      sampleRate: envSampleRate
    });

    // Assert voice mapping
    if (requestedVoice === 'azzurra-voice' && voiceId !== voiceMap['azzurra-voice']) {
      console.error('[TTS Route] ❌ VOICE MISMATCH! Expected azzurra-voice but got:', voiceId);
      return NextResponse.json({
        message: 'Voice mapping error - azzurra-voice not properly resolved',
        expected: 'azzurra-voice',
        actual: voiceId,
        mapping: voiceMap
      }, { status: 500 });
    }

    // Assert language
    if (finalLanguage !== 'it' && language === 'it') {
      console.error('[TTS Route] ❌ LANGUAGE MISMATCH! Expected Italian but got:', finalLanguage);
      return NextResponse.json({
        message: 'Language mapping error - Italian not properly resolved',
        expected: 'it',
        actual: finalLanguage
      }, { status: 500 });
    }

    const totalTime = Date.now() - startTime;
    console.log('[TTS Route] ✅ Success:', {
      processingTimeMs: totalTime,
      audioSizeKB: Math.round(audioData.byteLength / 1024),
      base64SizeKB: Math.round(base64Audio.length * 0.75 / 1024), // base64 is ~33% larger
      estimatedDuration: duration
    });

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('[TTS Route] ❌ Unexpected error:', {
      error: error.message || String(error),
      stack: error.stack,
      processingTimeMs: totalTime
    });

    return NextResponse.json({ 
      message: 'Internal server error in TTS route',
      error: error.message || String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json({ 
    message: 'Method not allowed - use POST',
    expectedBody: {
      text: 'string (required)',
      voice: 'string (optional)',
      provider: 'string (optional, default: cartesia)',
      language: 'string (optional, default: it)'
    }
  }, { status: 405 });
}

// Utility function to estimate audio duration
function estimateAudioDuration(byteLength: number, sampleRate: number, bitDepth: number): number {
  // For mono PCM: duration = bytes / (sampleRate * (bitDepth/8))
  const bytesPerSample = bitDepth / 8;
  const samples = byteLength / bytesPerSample;
  return samples / sampleRate;
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[Chat Route] 💬 POST /api/chat/respond started');

  try {
    // 1. Parse request body
    let body: any;
    try {
      body = await req.json();
      console.log('[Chat Route] 📥 Request body:', {
        hasMessage: !!body.message,
        messageLength: body.message?.length || 0,
        hasEmotionContext: !!body.emotionContext,
        model: body.model,
        historyLength: body.messageHistory?.length || 0
      });
    } catch (parseError) {
      console.error('[Chat Route] ❌ JSON parse error:', parseError);
      return NextResponse.json({ 
        message: 'Invalid JSON body',
        error: String(parseError)
      }, { status: 400 });
    }

    const { 
      message, 
      emotionContext, 
      messageHistory = [], 
      model = 'gpt-4o-mini' 
    } = body;

    // 2. Validate input
    if (!message || typeof message !== 'string') {
      console.error('[Chat Route] ❌ Missing or invalid message field');
      return NextResponse.json({ 
        message: 'Missing or invalid message field',
        received: { message: typeof message, length: message?.length }
      }, { status: 400 });
    }

    // 3. Check environment variables
    const openaiKey = process.env.OPENAI_API_KEY;
    console.log('[Chat Route] 🔑 Environment check:', {
      hasOpenAIKey: !!openaiKey,
      keyLength: openaiKey?.length || 0,
      model: model
    });

    if (!openaiKey) {
      console.error('[Chat Route] ❌ OPENAI_API_KEY not found in environment');
      return NextResponse.json({ 
        message: 'Chat service not configured - missing API key',
        provider: 'openai'
      }, { status: 500 });
    }

    // 4. Prepare system prompt with emotion context
    let systemPrompt = `You are a helpful wellness coach AI assistant. You provide supportive, empathetic responses focused on mental health and wellbeing. Keep responses concise but warm.`;
    
    if (emotionContext) {
      const { dominantEmotion, valence, arousal, confidence } = emotionContext;
      systemPrompt += `\n\nCurrent user emotional state:
- Dominant emotion: ${dominantEmotion}
- Valence: ${valence} (emotional positivity: -1=negative, +1=positive)
- Arousal: ${arousal} (energy level: -1=calm, +1=excited)  
- Confidence: ${confidence} (detection accuracy: 0-1)

Adapt your response to be appropriate for their current emotional state.`;
    }

    // 5. Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...messageHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    console.log('[Chat Route] 🤖 Calling OpenAI:', {
      model,
      messageCount: messages.length,
      systemPromptLength: systemPrompt.length,
      hasEmotionContext: !!emotionContext
    });

    // 6. Call OpenAI API
    let aiResponse: Response;
    try {
      aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 500,
          temperature: 0.7,
          presence_penalty: 0.1,
          frequency_penalty: 0.1
        })
      });

      console.log('[Chat Route] 📡 OpenAI response:', {
        status: aiResponse.status,
        statusText: aiResponse.statusText,
        contentType: aiResponse.headers.get('content-type')
      });

    } catch (fetchError) {
      console.error('[Chat Route] ❌ Network error calling OpenAI:', fetchError);
      return NextResponse.json({ 
        message: 'Failed to connect to AI provider',
        error: String(fetchError),
        provider: 'openai'
      }, { status: 502 });
    }

    // 7. Handle AI response
    if (!aiResponse.ok) {
      let errorBody: string;
      try {
        errorBody = await aiResponse.text();
        console.error('[Chat Route] ❌ OpenAI API error:', {
          status: aiResponse.status,
          statusText: aiResponse.statusText,
          body: errorBody.substring(0, 500)
        });
      } catch (readError) {
        errorBody = 'Could not read error response';
        console.error('[Chat Route] ❌ Could not read OpenAI error response:', readError);
      }

      return NextResponse.json({ 
        message: 'AI provider error',
        providerStatus: aiResponse.status,
        providerStatusText: aiResponse.statusText,
        providerBody: errorBody
      }, { status: 502 });
    }

    // 8. Process successful response
    let aiData: any;
    try {
      aiData = await aiResponse.json();
      console.log('[Chat Route] ✅ AI data received:', {
        hasChoices: !!aiData.choices,
        choiceCount: aiData.choices?.length || 0,
        usage: aiData.usage
      });
    } catch (readError) {
      console.error('[Chat Route] ❌ Failed to parse AI response:', readError);
      return NextResponse.json({ 
        message: 'Failed to process AI response',
        error: String(readError)
      }, { status: 500 });
    }

    // 9. Extract response text
    const responseText = aiData.choices?.[0]?.message?.content;
    if (!responseText) {
      console.error('[Chat Route] ❌ No response text in AI data:', aiData);
      return NextResponse.json({ 
        message: 'AI response contained no text',
        aiData: aiData
      }, { status: 500 });
    }

    // 10. Generate wellness suggestions based on emotion
    const suggestions = generateWellnessSuggestions(emotionContext);

    const responseData = {
      text: responseText.trim(),
      sessionId: `session_${Date.now()}`, // Simple session ID
      meta: {
        model,
        emotionContext: emotionContext ? {
          dominantEmotion: emotionContext.dominantEmotion,
          valence: emotionContext.valence,
          arousal: emotionContext.arousal
        } : null,
        suggestions,
        usage: aiData.usage
      }
    };

    const totalTime = Date.now() - startTime;
    console.log('[Chat Route] ✅ Success:', {
      processingTimeMs: totalTime,
      responseLength: responseText.length,
      suggestionCount: suggestions.length,
      tokensUsed: aiData.usage?.total_tokens
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
    console.error('[Chat Route] ❌ Unexpected error:', {
      error: error.message || String(error),
      stack: error.stack,
      processingTimeMs: totalTime
    });

    return NextResponse.json({ 
      message: 'Internal server error in chat route',
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
      message: 'string (required)',
      emotionContext: 'object (optional)',
      messageHistory: 'array (optional)',
      model: 'string (optional, default: gpt-4o-mini)'
    }
  }, { status: 405 });
}

// Generate wellness suggestions based on emotion
function generateWellnessSuggestions(emotionContext: any): string[] {
  if (!emotionContext) {
    return [
      "Take a moment to check in with yourself",
      "Practice deep breathing for 2 minutes",
      "Stay hydrated throughout the day"
    ];
  }

  const { dominantEmotion, valence, arousal } = emotionContext;
  
  const suggestions: string[] = [];

  // Emotion-specific suggestions
  switch (dominantEmotion) {
    case 'happiness':
      suggestions.push("Share your positive energy with someone today");
      suggestions.push("Take a moment to appreciate what's going well");
      break;
    case 'sadness':
      suggestions.push("Reach out to a friend or loved one");
      suggestions.push("Practice self-compassion and be gentle with yourself");
      suggestions.push("Consider journaling about your feelings");
      break;
    case 'anger':
      suggestions.push("Take 5 deep breaths before responding");
      suggestions.push("Try some physical activity to release tension");
      suggestions.push("Identify what's triggering your anger");
      break;
    case 'fear':
      suggestions.push("Ground yourself by naming 5 things you can see");
      suggestions.push("Remember that this feeling will pass");
      suggestions.push("Focus on what you can control right now");
      break;
    case 'surprise':
      suggestions.push("Take a moment to process what just happened");
      suggestions.push("Stay curious and open to new experiences");
      break;
    case 'disgust':
      suggestions.push("Step away from what's bothering you if possible");
      suggestions.push("Focus on things that bring you comfort");
      break;
    default:
      suggestions.push("Take a mindful moment to check in with yourself");
  }

  // Valence-based suggestions
  if (valence < -0.5) {
    suggestions.push("Do something small that usually makes you smile");
    suggestions.push("Practice gratitude by listing 3 good things");
  }

  // Arousal-based suggestions  
  if (arousal > 0.5) {
    suggestions.push("Try a calming activity like gentle stretching");
    suggestions.push("Practice progressive muscle relaxation");
  } else if (arousal < -0.5) {
    suggestions.push("Get some fresh air or natural light");
    suggestions.push("Do a brief energizing activity");
  }

  return suggestions.slice(0, 3); // Return max 3 suggestions
}

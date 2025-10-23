/**
 * Emotion Analysis Controller
 * Handles emotion detection and analysis requests
 */

import { Request, Response } from 'express';

interface EmotionRequest {
  image?: string; // Base64 encoded image
  text?: string;  // Text for emotion analysis
  sessionId?: string;
}

interface EmotionResponse {
  dominantEmotion: string;
  valence: number; // -1 to 1 (negative to positive)
  arousal: number;  // 0 to 1 (calm to excited)
  confidence: number; // 0 to 1
  emotions: {
    happiness: number;
    sadness: number;
    anger: number;
    fear: number;
    surprise: number;
    disgust: number;
  };
  timestamp: string;
}

export const analyzeEmotion = async (req: Request, res: Response) => {
  try {
    const { image, text, sessionId = 'default' }: EmotionRequest = req.body;

    console.log('[Emotion] 🎭 Processing emotion analysis:', {
      hasImage: !!image,
      hasText: !!text,
      sessionId
    });

    let result: EmotionResponse;

    if (image) {
      // For now, use text-based analysis as fallback
      // In the future, this could integrate with a cloud API
      console.log('[Emotion] 📸 Image provided, using fallback analysis');
      result = await analyzeTextEmotion('Image analysis - using fallback');
    } else if (text) {
      // Text-based emotion analysis
      result = await analyzeTextEmotion(text);
    } else {
      throw new Error('Either image or text must be provided');
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Emotion] ❌ Analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Emotion analysis failed'
    });
  }
};

// Fallback text-based emotion analysis
async function analyzeTextEmotion(text: string): Promise<EmotionResponse> {
  console.log('[Emotion] 📝 Analyzing text emotion...');
  
  // Simple keyword-based emotion detection
  const emotions = {
    happiness: 0,
    sadness: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
    disgust: 0,
  };

  const lowerText = text.toLowerCase();
  
  // Happiness keywords
  const happyWords = ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'smile', 'laugh'];
  emotions.happiness = happyWords.reduce((score, word) => 
    score + (lowerText.includes(word) ? 0.2 : 0), 0);

  // Sadness keywords
  const sadWords = ['sad', 'depressed', 'down', 'cry', 'hurt', 'pain', 'lonely', 'upset'];
  emotions.sadness = sadWords.reduce((score, word) => 
    score + (lowerText.includes(word) ? 0.2 : 0), 0);

  // Anger keywords
  const angryWords = ['angry', 'mad', 'furious', 'rage', 'hate', 'annoyed', 'irritated'];
  emotions.anger = angryWords.reduce((score, word) => 
    score + (lowerText.includes(word) ? 0.2 : 0), 0);

  // Fear keywords
  const fearWords = ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'terrified'];
  emotions.fear = fearWords.reduce((score, word) => 
    score + (lowerText.includes(word) ? 0.2 : 0), 0);

  // Surprise keywords
  const surpriseWords = ['surprised', 'shocked', 'amazed', 'wow', 'unexpected'];
  emotions.surprise = surpriseWords.reduce((score, word) => 
    score + (lowerText.includes(word) ? 0.2 : 0), 0);

  // Disgust keywords
  const disgustWords = ['disgusted', 'gross', 'nasty', 'revolting', 'sick'];
  emotions.disgust = disgustWords.reduce((score, word) => 
    score + (lowerText.includes(word) ? 0.2 : 0), 0);

  // Normalize emotions
  const total = Object.values(emotions).reduce((sum, val) => sum + val, 0);
  if (total > 0) {
    Object.keys(emotions).forEach(key => {
      emotions[key as keyof typeof emotions] = emotions[key as keyof typeof emotions] / total;
    });
  } else {
    // Default to neutral if no emotions detected
    emotions.happiness = 0.5;
  }

  // Find dominant emotion
  const dominantEmotion = Object.entries(emotions).reduce((a, b) => 
    emotions[a[0] as keyof typeof emotions] > emotions[b[0] as keyof typeof emotions] ? a : b
  )[0];

  // Calculate valence and arousal
  const valence = (emotions.happiness + emotions.surprise * 0.5) - 
                 (emotions.sadness + emotions.anger + emotions.fear + emotions.disgust);
  const arousal = (emotions.anger + emotions.fear + emotions.surprise) * 0.7 + 
                 (emotions.happiness + emotions.sadness) * 0.3;

  return {
    dominantEmotion,
    valence: Math.max(-1, Math.min(1, valence)),
    arousal: Math.max(0, Math.min(1, arousal)),
    confidence: 0.7, // Lower confidence for text analysis
    emotions,
    timestamp: new Date().toISOString()
  };
}

export const getEmotionHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId = 'default', days = 7 } = req.query;

    console.log('[Emotion] 📊 Fetching emotion history:', { sessionId, days });

    // Generate mock historical data
    const history = [];
    const now = new Date();
    
    for (let i = parseInt(days as string) - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      history.push({
        date: date.toISOString().split('T')[0],
        emotions: {
          happiness: Math.random() * 0.8 + 0.1,
          sadness: Math.random() * 0.3,
          anger: Math.random() * 0.2,
          fear: Math.random() * 0.2,
          surprise: Math.random() * 0.3,
          disgust: Math.random() * 0.1
        },
        averageValence: Math.random() * 1.4 - 0.7, // -0.7 to 0.7
        averageArousal: Math.random() * 0.8 + 0.1,  // 0.1 to 0.9
        moodScore: Math.random() * 4 + 6 // 6-10 scale
      });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        history,
        summary: {
          averageMood: history.reduce((sum, day) => sum + day.moodScore, 0) / history.length,
          trend: history.length > 1 ? 
            (history[history.length - 1].moodScore - history[0].moodScore) : 0,
          mostCommonEmotion: 'happiness'
        }
      }
    });

  } catch (error) {
    console.error('[Emotion] ❌ History fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch emotion history'
    });
  }
};

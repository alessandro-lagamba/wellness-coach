/**
 * Shared emotion mapping module - converts MediaPipe blendshapes to emotion metrics
 * Can be reused across web and mobile platforms
 */

export type Blendshape = { 
  categoryName: string; 
  score: number; 
};

export type EmotionMetrics = {
  emotions: Record<"happiness"|"sadness"|"anger"|"fear"|"surprise"|"disgust"|"neutral", number>;
  valence: number;   // [-1, +1]
  arousal: number;   // [-1, +1]
  confidence: number;// [0, 1]
  dominantEmotion: keyof EmotionMetrics["emotions"];
  source: "mediapipe-blendshapes" | "simplified";
};

const get = (list: Blendshape[], name: string) =>
  list.find(b => b.categoryName === name)?.score ?? 0;

export function mapBlendshapesToEmotionMetrics(blendshapes: Blendshape[], facePresence: number): EmotionMetrics {
  // Extract key blendshape features (MediaPipe naming)
  const smile = get(blendshapes, "mouthSmileLeft") * 0.5 + get(blendshapes, "mouthSmileRight") * 0.5;
  const frown = get(blendshapes, "browDownLeft") * 0.5 + get(blendshapes, "browDownRight") * 0.5;
  const browUp = get(blendshapes, "browInnerUp");
  const jawOpen = get(blendshapes, "jawOpen");
  const eyeWide = get(blendshapes, "eyeWideLeft") * 0.5 + get(blendshapes, "eyeWideRight") * 0.5;
  const noseWrinkle = get(blendshapes, "noseSneerLeft") * 0.5 + get(blendshapes, "noseSneerRight") * 0.5;
  const mouthPucker = get(blendshapes, "mouthPucker");
  const eyeSquint = get(blendshapes, "eyeSquintLeft") * 0.5 + get(blendshapes, "eyeSquintRight") * 0.5;
  const cheekSquint = get(blendshapes, "cheekSquintLeft") * 0.5 + get(blendshapes, "cheekSquintRight") * 0.5;

  // Heuristics for emotion mapping (light and stable)
  const happiness = clamp01(0.8 * smile + 0.2 * cheekSquint);
  const sadness = clamp01(0.7 * frown + 0.3 * mouthPucker);
  const anger = clamp01(0.6 * frown + 0.4 * eyeSquint);
  const fear = clamp01(0.6 * eyeWide + 0.4 * jawOpen);
  const surprise = clamp01(0.7 * jawOpen + 0.3 * browUp + 0.2 * eyeWide);
  const disgust = clamp01(0.7 * noseWrinkle + 0.3 * mouthPucker);

  const neutralRaw = Math.max(0, 1 - (happiness + sadness + anger + fear + surprise + disgust));
  const emotions = normalize({
    happiness, 
    sadness, 
    anger, 
    fear, 
    surprise, 
    disgust, 
    neutral: neutralRaw
  });

  // Calculate valence and arousal (consistent with psychological models)
  const valence = clamp(-1, 1, 
    +emotions.happiness + 0.2 * emotions.surprise 
    - emotions.anger - emotions.sadness - 0.5 * emotions.disgust
  );
  
  const arousal = clamp(-1, 1, 
    +0.8 * emotions.surprise + 0.6 * emotions.anger + 0.5 * emotions.fear 
    - 0.6 * emotions.sadness - 0.5 * emotions.neutral
  );

  // Find dominant emotion
  const dominantEntry = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0];
  const dominantEmotion = dominantEntry[0] as keyof EmotionMetrics["emotions"];
  const confidence = clamp01(facePresence * Math.max(...Object.values(emotions)));

  return { 
    emotions, 
    valence, 
    arousal, 
    confidence, 
    dominantEmotion, 
    source: "mediapipe-blendshapes" 
  };
}

// Utility functions
function clamp01(x: number): number { 
  return Math.max(0, Math.min(1, x)); 
}

function clamp(min: number, max: number, x: number): number { 
  return Math.max(min, Math.min(max, x)); 
}

function normalize(obj: Record<string, number>) {
  const s = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
  const out: any = {};
  Object.keys(obj).forEach(k => out[k] = obj[k] / s);
  return out as Record<keyof typeof obj, number>;
}

/**
 * Fallback function for simplified emotion detection
 * Uses brightness and color variance heuristics
 */
export function createSimplifiedEmotionMetrics(
  brightness: number = 0.5, 
  colorVariance: number = 0.3
): EmotionMetrics {
  const time = Date.now() / 1000;
  const variation = (Math.sin(time * 0.5) + 1) / 2; // Slow variation for demo
  
  const happiness = Math.max(0, Math.min(1, brightness * 0.7 + variation * 0.3));
  const neutral = Math.max(0, Math.min(1, 0.6 - Math.abs(brightness - 0.5)));
  const sadness = Math.max(0, Math.min(1, (1 - brightness) * 0.5));
  const surprise = Math.max(0, Math.min(1, colorVariance * 0.3));
  const anger = Math.max(0, Math.min(1, colorVariance * 0.2));
  const fear = Math.max(0, Math.min(1, (1 - brightness) * colorVariance * 0.3));
  const disgust = Math.max(0, Math.min(1, 0.1));
  
  const emotions = normalize({
    happiness, sadness, anger, fear, surprise, disgust, neutral
  });

  const valence = happiness - sadness - anger - disgust;
  const arousal = anger + fear + surprise - sadness;
  const dominantEntry = Object.entries(emotions).reduce((a, b) => 
    emotions[a[0] as keyof typeof emotions] > emotions[b[0] as keyof typeof emotions] ? a : b
  );
  const dominantEmotion = dominantEntry[0] as keyof EmotionMetrics["emotions"];
  const confidence = Math.max(...Object.values(emotions));

  return {
    emotions,
    valence: Math.max(-1, Math.min(1, valence)),
    arousal: Math.max(-1, Math.min(1, arousal)),
    dominantEmotion,
    confidence,
    source: "simplified"
  };
}

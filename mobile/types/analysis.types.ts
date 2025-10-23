// Additional UI Types
export interface EmotionData {
  emotion: 'joy' | 'sadness' | 'neutral' | 'surprise' | 'anger' | 'disgust' | 'fear';
  percentage: number;
  color: string;
  icon: string;
}

export interface SkinAnalysisResults {
  hydration: number;
  oiliness: number;
  sensitivity: number;
  pigmentation: number;
  recommendations: string[];
}

export interface EmotionSession {
  id: string;
  timestamp: Date;
  dominantEmotion: string;
  confidence: number;
  avgValence: number;
  avgArousal: number;
}

export interface SkinCapture {
  id: string;
  timestamp: Date;
  scores: {
    texture: number;
    redness: number;
    shine: number;
    overall: number;
  };
  confidence: number;
  quality: {
    lighting: number;
    focus: number;
    roi_coverage: number;
  };
  photoUri: string;
}

export interface EmotionScores {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
  neutral: number;
}

export interface EmotionAnalysisResult {
  dominant_emotion: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'neutral';
  emotions: EmotionScores;
  valence: number; // -1 to 1
  arousal: number; // -1 to 1
  confidence: number; // 0 to 1
  observations: string[]; // max 5 items
  recommendations: string[]; // max 5 items
  version: string;
}

export interface SkinScores {
  texture: number; // 0 to 100
  redness: number; // 0 to 100
  oiliness: number; // 0 to 100
  hydration: number; // 0 to 100
  overall: number; // 0 to 100
}

export interface SkinAnalysisResult {
  scores: SkinScores;
  issues: string[]; // max 6 items
  recommendations: string[]; // max 6 items
  confidence: number; // 0 to 1
  notes: string[]; // max 5 items
  version: string;
}

export interface AnalysisRequest {
  imageUri: string;
  analysisType: 'emotion' | 'skin';
  sessionId?: string;
  timestamp?: Date;
}

export interface AnalysisResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  processingTime?: number;
  timestamp: Date;
}

export interface AnalysisHistory {
  id: string;
  type: 'emotion' | 'skin';
  result: EmotionAnalysisResult | SkinAnalysisResult;
  imageUri: string;
  timestamp: Date;
  sessionId?: string;
}

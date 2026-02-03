// OpenAI Analysis Service
import { API_CONFIG } from '../config/api.config';
import {
  EmotionAnalysisResult,
  SkinAnalysisResult,
  FoodAnalysisResult,
  AnalysisRequest,
  AnalysisResponse,
  AnalysisHistory
} from '../types/analysis.types';
import * as FileSystem from 'expo-file-system/legacy';
import { getUserLanguage, getLanguageInstruction } from './language.service';
import { EmotionAnalysisService } from './emotion-analysis.service';

class OpenAIRefusalError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'OpenAIRefusalError';
  }
}

type VisionPurpose = 'emotion' | 'skin' | 'food';

interface VisionAttempt {
  model: string;
  prompt: string;
}

interface VisionAnalysisParams<T> {
  basePrompt: string;
  languageInstruction: string;
  imageBase64: string;
  parser: (content: string) => T;
  purpose: VisionPurpose;
}

export class OpenAIAnalysisService {
  private static instance: OpenAIAnalysisService;
  private apiKey: string | null = null;
  private baseUrl: string = API_CONFIG.OPENAI.BASE_URL;
  private readonly primaryModel = API_CONFIG.OPENAI.MODEL;
  private readonly version = '1.0.0';

  // Prompts esatti come specificati dall'utente
  private readonly EMOTION_DETECTION_PROMPT = `
You are an expert facial emotion analyst trained in FACS (Facial Action Coding System) and micro-expression reading. 
You also help people understand the emotional signals present in a face, focusing on small, often overlooked expressions.
 
TASK
Analyze ONE face photo and return ONE JSON object (no markdown, no schema, no extra keys).
This is a consumer wellness app: results must feel specific, accurate, and useful today, but not too technical.
 
CONSTRAINTS (HARD)
- Base the emotional reading primarily on visible facial cues (eyebrows, eyes/eyelids, mouth/lips, jaw/cheeks, forehead tension). 
Historical and contextual data may be used to gently calibrate tone or contrast, without attributing causes.
- Do NOT infer from background, clothing, age, gender, identity, or context.
- Look for MICRO-EXPRESSIONS: subtle muscle tensions that reveal underlying emotions.
 
STYLE (HARD)
- User-centered, warm, non-clinical.
- NO textbook explanations ("a smile means joy").
- NO deficit framing: never say "lack of joy", "below normal", "something missing".
  Use "quieter / more contained / lower outward expressiveness / calmer or more cautious tone" instead.
 
SCORING (CRITICAL - READ CAREFULLY)
Emotions: joy, sadness, anger, fear, surprise, disgust, neutral.
- Values in [0,1] and MUST sum to 1 (normalize if needed).
- AVOID NEUTRAL BIAS: Most faces show SOME emotion even if subtle. Neutral should NOT be used if there are visible signs of sadness, heaviness, or emotional withdrawal.
- neutral > 0.50 ONLY if: face is truly expressionless AND eyes show no emotion AND mouth is completely relaxed.
- At least TWO non-neutral emotions should be > 0.10 in most cases.
- The dominant_emotion should match the HIGHEST score (never default to neutral if another emotion is higher).
 
Intensity guide (be generous with detection):
- strong 0.45–0.75, moderate 0.25–0.45, subtle 0.12–0.25, trace 0.05–0.12.
 
MICRO-EXPRESSION DETECTION:
- Slight eyebrow raise/furrow = fear or surprise (even subtle)
- Lip corner tension (even slight) = sadness or disgust
- Downward mouth corners combined with inner brow tension strongly = sadness
- Jaw tension or clenching = anger (even if smiling)
- Eye narrowing = anger or disgust or concentration
- Nostril flare = anger or disgust
- Asymmetric smile = mixed emotions (not pure joy)
- Pressed lips = suppressed anger or frustration
- Inner eyebrow raise = sadness (even if smiling)
- Redness around eyes, watery eyes, or puffy eyelids = crying (high sadness score).
- One-sided lip raise or asymmetric tension = sneer/smirk (contempt/disgust).
 
Consistency:
- Visible smile => joy > 0.2 (but check for asymmetry or tension).
- Fear/anger > 0.25 => arousal must be > 0.
- Joy > 0.25 => valence must be > 0.
- Sadness dominant => valence < 0 and arousal <= 0.
- If face shows MIXED signals (smile + tense eyes), distribute scores across emotions.
 
VALENCE & AROUSAL (HARD)
- valence and arousal MUST be in [-1, +1], never 0–100.
- Avoid exact 0 unless the face is truly blank.
- Vary your scores: don't always output near-zero values.
Valence: clear positive +0.4..+0.8, mild +0.15..+0.4, ambiguous -0.1..+0.1, mild negative -0.15..-0.4, strong negative -0.5..-0.8.
Arousal: high +0.4..+0.8, moderate +0.2..+0.4, neutral -0.1..+0.1, low -0.2..-0.5, very low -0.5..-0.8.
 
 
HISTORICAL CONTEXT (IF PROVIDED)
You may receive a short baseline summary.
- Use it ONLY to add ONE brief comparison in analysis_description (soft, non-judgmental).
- Do NOT invent causes. Use cautious language ("may", "could").
 
OUTPUT (STRICT)
Return ONLY this JSON shape and EXACT keys:
{
  "dominant_emotion": "joy|sadness|anger|fear|surprise|disgust|neutral",
  "emotions": {"joy":n,"sadness":n,"anger":n,"fear":n,"surprise":n,"disgust":n,"neutral":n},
  "valence": n,
  "arousal": n,
  "confidence": n,
  "observations": [string],
  "recommendations": [string,string,string],
  "analysis_description": string,
  "version": "1.0"
}
 
Rules for observations (SINGLE PARAGRAPH):
- Treat facial cues as implicit evidence, not as narrative elements.
  Observations should primarily describe the emotional stance or present emotional posture, using facial signals only as a subtle backdrop.
- Observations should feel open-ended, leaving space rather than closing the emotional meaning.
- Focus on how this emotional state shows up as a quality of presence in the moment.
- Prefer perceptual, human language over analytical or diagnostic phrasing.
- Prefer descriptive phrasing over interpretive phrasing.
- Let the emotional meaning emerge implicitly.
- No brackets [], no arrows, no bullet formatting inside strings.
 
Rules for recommendations (EXACTLY 3):
- Under 5 minutes, decision-oriented, linked to the detected state.
- Focus on what this state is GOOD FOR right now (focus/social/decision/reflection/energy regulation).
`;

  private readonly SKIN_ANALYSIS_PROMPT = `You are a dermatology-assistant focused on NON-diagnostic cosmetic skin assessment from a single photo.
  Your goal is to provide practical, everyday, cosmetic guidance based on visible features. You may describe common cosmetic issues—including acne-like breakouts, clogged pores, shaving irritation, or sensitivity-related redness—but you must NOT diagnose medical skin diseases.
  
  Task:
  - Analyze visible skin quality (texture, redness, oiliness, hydration) based ONLY on what is visible in the image.
  - Consider lighting, shadows, focus, makeup, filters, beard coverage, hats, and over/under-exposure.
  - Return STRICT JSON following the schema below. Do NOT output anything outside the JSON.
  
  Constraints & Safety:
  - You MAY mention common cosmetic concerns such as: mild acne-like breakouts, clogged pores, comedone-like bumps, post-shave redness, ingrown-hair–like bumps, dark marks, uneven texture, sensitivity-like redness, dryness, oily shine, or cosmetic irritation.
  - You MUST NOT mention or diagnose medical conditions (e.g., acne as a diagnosis, rosacea, dermatitis, melasma, eczema, infections, psoriasis, folliculitis). Use neutral cosmetic alternatives when needed (e.g., “acne-like bumps”, “persistent redness-like appearance”).
  - If something appears unusual (very dark, irregular, or atypical), add a neutral note suggesting evaluation by a dermatologist.
  - If the face is partially visible or obstructed (beard, hair, hat, shadows), base analysis only on visible areas and mention this in "notes". Reduce confidence accordingly.
  
  Recommendations:
  - Provide 3–5 recommendations.
  - Each recommendation must be ONE sentence (15–25 words), explaining WHAT to do, WHEN to do it, and WHY it helps.
  - Use only cosmetic, non-medical ingredients (e.g., niacinamide 2–5%, hyaluronic acid, salicylic acid 0.5–2%, panthenol, azelaic acid cosmetic use). No brand names. No prescription-level actives such as retinoids or benzoyl peroxide.
  - Tailor recommendations to the issues identified.
  
  Analysis Description:
  - Provide a short, educational paragraph (2–3 sentences) explaining what the scores mean, what the user’s skin shows based on the photo, and include one general wellness tip (hydration, sun protection, sleep, shaving habits, etc.).
  
  Confidence:
  - Score 0.7–1.0 for clear lighting and visibility.
  - Score 0.3–0.6 for moderate limitations.
  - Score 0.1–0.3 for strong filters, poor lighting, or unclear visibility.
  
  Schema: {
    "type":"object",
    "required":["scores","issues","recommendations","confidence","notes","analysis_description","version"],
    "properties":{
      "scores":{
        "type":"object",
        "required":["texture","redness","oiliness","hydration","overall"],
        "properties":{
          "texture":{"type":"number","minimum":0,"maximum":100},
          "redness":{"type":"number","minimum":0,"maximum":100},
          "oiliness":{"type":"number","minimum":0,"maximum":100},
          "hydration":{"type":"number","minimum":0,"maximum":100},
          "overall":{"type":"number","minimum":0,"maximum":100}
        }
      },
      "issues":{"type":"array","items":{"type":"string"}, "maxItems":6},
      "recommendations":{"type":"array","items":{"type":"string"}, "maxItems":6},
      "confidence":{"type":"number","minimum":0,"maximum":1},
      "notes":{"type":"array","items":{"type":"string"}, "maxItems":5},
      "analysis_description":{"type":"string"},
      "version":{"type":"string"}
    }
  }`;

  public static getInstance(): OpenAIAnalysisService {
    if (!OpenAIAnalysisService.instance) {
      OpenAIAnalysisService.instance = new OpenAIAnalysisService();
    }
    return OpenAIAnalysisService.instance;
  }

  /**
   * Initialize the service with API key
   */
  async initialize(apiKey?: string): Promise<boolean> {
    try {
      // Try to get API key from environment or parameter
      this.apiKey = apiKey || API_CONFIG.OPENAI.API_KEY || null;

      if (!this.apiKey) {
        console.warn('OpenAI API key not provided. Analysis will not work.');
        return false;
      }

      // Test the API key with a simple request
      await this.testConnection();
      return true;
    } catch (error) {
      console.error('Failed to initialize OpenAI Analysis Service:', error);
      return false;
    }
  }

  /**
   * Test API connection
   */
  private async testConnection(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API connection failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Analyze emotion from image
   */
  async analyzeEmotion(request: AnalysisRequest): Promise<AnalysisResponse<EmotionAnalysisResult>> {
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      if (request.analysisType !== 'emotion') {
        throw new Error('Invalid analysis type for emotion detection');
      }

      // Convert image to base64
      const imageBase64 = await this.convertImageToBase64(request.imageUri);

      // Get user language and build full prompt with language instructions
      const userLanguage = await getUserLanguage();
      const languageInstruction = getLanguageInstruction(userLanguage);

      // 🆕 Build historical context if userId is provided
      let historicalContext = '';
      if (request.userId) {
        historicalContext = await this.buildHistoricalContext(request.userId);
      }

      // Combine base prompt with historical context
      const fullPrompt = this.EMOTION_DETECTION_PROMPT + historicalContext;

      const analysisResult = await this.runVisionAnalysis<EmotionAnalysisResult>({
        basePrompt: fullPrompt,
        languageInstruction,
        imageBase64,
        parser: (content) => this.parseAndValidateEmotionResult(content),
        purpose: 'emotion',
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: analysisResult,
        processingTime,
        timestamp: new Date(),
      };

    } catch (error) {
      console.error('Emotion analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Analyze skin from image
   */
  async analyzeSkin(request: AnalysisRequest): Promise<AnalysisResponse<SkinAnalysisResult>> {
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      if (request.analysisType !== 'skin') {
        throw new Error('Invalid analysis type for skin analysis');
      }

      // Convert image to base64
      const imageBase64 = await this.convertImageToBase64(request.imageUri);

      // Get user language and build full prompt with language instructions
      const userLanguage = await getUserLanguage();
      const languageInstruction = getLanguageInstruction(userLanguage);
      const analysisResult = await this.runVisionAnalysis<SkinAnalysisResult>({
        basePrompt: this.SKIN_ANALYSIS_PROMPT,
        languageInstruction,
        imageBase64,
        parser: (content) => this.parseAndValidateSkinResult(content),
        purpose: 'skin',
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: analysisResult,
        processingTime,
        timestamp: new Date(),
      };

    } catch (error) {
      console.error('Skin analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Convert image URI to base64
   */
  private async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      // For React Native, we need to handle different URI types
      if (imageUri.startsWith('data:')) {
        // Already base64
        return imageUri.split(',')[1];
      } else if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
        // Local file - use robust base64 conversion
        return await this.fileToBase64(imageUri);
      } else if (imageUri.startsWith('http')) {
        // Remote URL - fetch and convert
        const response = await fetch(imageUri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        throw new Error(`Unsupported image URI format: ${imageUri}`);
      }
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Robust file to base64 conversion that works in Expo Go & dev builds
   */
  private async fileToBase64(uri: string): Promise<string> {
    try {
      let fileUri = uri;

      // Some Android devices may give content:// URIs. Copy to cache first.
      if (fileUri.startsWith('content://')) {
        const target = `${FileSystem.cacheDirectory}upload-${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: fileUri, to: target });
        fileUri = target;
      }

      // Prefer literal 'base64' (works even if EncodingType is undefined)
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        // @ts-ignore – RN accepts the literal
        encoding: 'base64',
      });

      return base64;
    } catch (e) {
      console.error('Failed to convert file to base64:', e);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Parse and validate emotion analysis result
   */
  private parseAndValidateEmotionResult(content: string): EmotionAnalysisResult {
    try {
      // Clean the content - remove any markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const result = JSON.parse(cleanContent) as EmotionAnalysisResult;

      // Validate required fields
      if (!result.dominant_emotion || !result.emotions || typeof result.valence !== 'number' ||
        typeof result.arousal !== 'number' || typeof result.confidence !== 'number') {
        throw new Error('Invalid emotion analysis result structure');
      }

      // Validate emotion scores
      const emotionKeys = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral'];
      for (const key of emotionKeys) {
        if (typeof result.emotions[key] !== 'number' || result.emotions[key] < 0 || result.emotions[key] > 1) {
          throw new Error(`Invalid emotion score for ${key}`);
        }
      }

      // Validate ranges
      if (result.valence < -1 || result.valence > 1) {
        throw new Error('Valence must be between -1 and 1');
      }
      if (result.arousal < -1 || result.arousal > 1) {
        throw new Error('Arousal must be between -1 and 1');
      }
      if (result.confidence < 0 || result.confidence > 1) {
        throw new Error('Confidence must be between 0 and 1');
      }

      // 🆕 FIX: Se observations è una stringa (errore AI), convertila in array
      if (typeof result.observations === 'string') {
        result.observations = [result.observations];
      }
      result.observations = Array.isArray(result.observations) ? result.observations : [];
      result.recommendations = result.recommendations || [];
      result.version = result.version || this.version;

      return result;
    } catch (error) {
      console.error('Failed to parse emotion analysis result:', error);
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  /**
   * Parse and validate skin analysis result
   */
  private parseAndValidateSkinResult(content: string): SkinAnalysisResult {
    try {
      // Clean the content - remove any markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const result = JSON.parse(cleanContent) as SkinAnalysisResult;

      // Validate required fields
      if (!result.scores || typeof result.confidence !== 'number') {
        throw new Error('Invalid skin analysis result structure');
      }

      // Validate skin scores
      const scoreKeys = ['texture', 'redness', 'oiliness', 'hydration', 'overall'];
      for (const key of scoreKeys) {
        if (typeof result.scores[key] !== 'number' || result.scores[key] < 0 || result.scores[key] > 100) {
          throw new Error(`Invalid skin score for ${key}`);
        }
      }

      // Validate confidence
      if (result.confidence < 0 || result.confidence > 1) {
        throw new Error('Confidence must be between 0 and 1');
      }

      // Ensure arrays exist and have reasonable lengths
      result.issues = result.issues || [];
      result.recommendations = result.recommendations || [];
      result.notes = result.notes || [];
      result.version = result.version || this.version;

      return result;
    } catch (error) {
      console.error('Failed to parse skin analysis result:', error);
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  /**
   * Analyze food from image
   * Now uses backend API instead of direct OpenAI call
   */
  async analyzeFood(request: AnalysisRequest): Promise<AnalysisResponse<FoodAnalysisResult>> {
    const startTime = Date.now();

    try {
      if (request.analysisType !== 'food') {
        throw new Error('Invalid analysis type for food analysis');
      }

      // Import getBackendURL dynamically to avoid circular dependencies
      const { getBackendURL } = await import('../constants/env');
      const backendURL = await getBackendURL();

      // Validate backend URL
      if (!backendURL || backendURL === 'https://your-backend.com') {
        console.error('[FoodAnalysis] Backend URL not configured:', backendURL);
        throw new Error('Backend URL not configured. Please check your environment settings.');
      }

      // Convert image to base64
      console.log('[FoodAnalysis] Converting image to base64...');
      const imageBase64 = await this.convertImageToBase64(request.imageUri);

      if (!imageBase64 || imageBase64.length < 100) {
        throw new Error('Failed to convert image to base64 - image data is too small or empty');
      }

      console.log('[FoodAnalysis] Calling backend:', `${backendURL}/api/nutrition/analyze-image`);

      // Call backend nutrition API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(`${backendURL}/api/nutrition/analyze-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
            mealType: request.mealType,
            prefs: request.prefs,
            allergies: request.allergies,
            locale: 'it-IT',
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[FoodAnalysis] Backend error:', response.status, errorData);
          throw new Error(`Backend request failed: ${response.status} - ${errorData.error || response.statusText}`);
        }

        const data = await response.json();

        if (!data.success || !data.data) {
          console.error('[FoodAnalysis] Invalid response:', data);
          throw new Error(data.error || 'Invalid response from backend');
        }

        // Convert backend MealDraft format to FoodAnalysisResult format
        const mealDraft = data.data;
        const analysisResult = this.convertMealDraftToFoodResult(mealDraft);

        const processingTime = Date.now() - startTime;
        console.log('[FoodAnalysis] Analysis complete in', processingTime, 'ms');

        return {
          success: true,
          data: analysisResult,
          processingTime,
          timestamp: new Date(),
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Food analysis timed out. Please try again.');
        }
        throw fetchError;
      }

    } catch (error: any) {
      console.error('[FoodAnalysis] Error:', error?.message || error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Analyze food from text description
   * Uses backend API to estimate nutrition from a description
   */
  async analyzeFoodFromText(text: string, mealType?: string): Promise<AnalysisResponse<FoodAnalysisResult>> {
    const startTime = Date.now();

    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Description is required');
      }

      // Import getBackendURL dynamically to avoid circular dependencies
      const { getBackendURL } = await import('../constants/env');
      const backendURL = await getBackendURL();
      console.log('[OpenAIAnalysis] Calling backend text analysis:', `${backendURL}/api/nutrition/analyze-text`);

      // Call backend nutrition API
      const response = await fetch(`${backendURL}/api/nutrition/analyze-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          mealType: mealType,
          locale: 'it-IT',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Backend request failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Invalid food analysis response from backend');
      }

      // Convert backend MealDraft format to FoodAnalysisResult format
      const mealDraft = data.data;
      const analysisResult = this.convertMealDraftToFoodResult(mealDraft);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: analysisResult,
        processingTime,
        timestamp: new Date(),
      };

    } catch (error) {
      console.error('Food text analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Convert MealDraft from backend to FoodAnalysisResult format
   */
  private convertMealDraftToFoodResult(mealDraft: any): FoodAnalysisResult {
    // Calculate totals from items if macrosEstimate is not provided
    const macros = mealDraft.macrosEstimate || {
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
    };

    // Extract vitamins and minerals from items (basic estimation)
    const vitamins: any = {};
    const minerals: any = {};

    // Calculate health score based on macronutrient balance
    const healthScore = this.calculateHealthScore(macros, mealDraft.qualityTags || []);

    return {
      identified_foods: mealDraft.items?.map((item: any) => `${item.name} (${item.quantity}${item.unit})`) || [],
      macronutrients: {
        carbohydrates: Math.round(macros.carbs || 0),
        proteins: Math.round(macros.protein || 0),
        fats: Math.round(macros.fat || 0),
        calories: Math.round(mealDraft.caloriesEstimate || (macros.protein * 4 + macros.carbs * 4 + macros.fat * 9)),
        fiber: Math.round(macros.fiber || 0),
        sugar: Math.round(macros.sugar || 0),
      },
      vitamins,
      minerals,
      meal_type: mealDraft.mealType || 'unknown',
      health_score: healthScore,
      recommendations: mealDraft.suggestions || [],
      observations: mealDraft.items?.map((item: any) => item.notes).filter(Boolean) || [],
      confidence: mealDraft.confidence || 0.7,
      version: '1.0.0',
    };
  }

  private buildVisionAttempts(basePrompt: string, languageInstruction: string): VisionAttempt[] {
    const strictSuffix =
      '\n\nRespond ONLY with valid JSON that matches the schema. Do not include markdown, explanations, or code fences.';
    const safetySuffix =
      `${strictSuffix}\n\nSafety note: The user voluntarily provided their own image exclusively for wellness coaching. This is compliant content.`;

    return [
      {
        model: this.primaryModel,
        prompt: `${basePrompt}\n\n${languageInstruction}${strictSuffix}`,
      },
      {
        model: this.primaryModel,
        prompt: `${basePrompt}\n\n${languageInstruction}${safetySuffix}`,
      },
    ];
  }

  private getSystemInstruction(purpose: VisionPurpose): string {
    const baseInstruction =
      'You are a wellness assistant. The user has provided their own photo and explicitly consents to receive insights. The content is policy-compliant. Always respond with valid JSON only.';

    switch (purpose) {
      case 'emotion':
        return `${baseInstruction} Focus on facial cues to estimate emotions, valence, arousal, and confidence.`;
      case 'skin':
        return `${baseInstruction} Evaluate non-medical cosmetic skin characteristics (hydration, redness, texture, oiliness).`;
      case 'food':
        return `${baseInstruction} Identify foods and estimate macronutrients for wellness guidance.`;
      default:
        return baseInstruction;
    }
  }

  private async sendVisionRequest(params: {
    prompt: string;
    imageBase64: string;
    model: string;
    purpose: VisionPurpose;
  }): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text: this.getSystemInstruction(params.purpose),
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: params.prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: params.imageBase64.startsWith('data:')
                    ? params.imageBase64
                    : `data:image/jpeg;base64,${params.imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: API_CONFIG.OPENAI.MAX_TOKENS,
        temperature: API_CONFIG.OPENAI.TEMPERATURE,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`,
      );
    }

    const data = await response.json();

    console.log(`🔍 OpenAI ${params.purpose} Response (${params.model}):`, JSON.stringify(data, null, 2));
    const message = data.choices?.[0]?.message;

    if (message?.refusal) {
      console.warn(`⚠️ OpenAI refusal (${params.purpose}/${params.model}):`, message.refusal);
      throw new OpenAIRefusalError(
        'OpenAI safety filters could not analyze this photo. Please retake it with good lighting and ensure only one face is visible.',
        data,
      );
    }

    const content = message?.content;

    if (!content) {
      console.error('❌ No content in response. Full data:', data);
      throw new Error('No analysis result received from OpenAI');
    }

    return content;
  }

  private async runVisionAnalysis<T>({
    basePrompt,
    languageInstruction,
    imageBase64,
    parser,
    purpose,
  }: VisionAnalysisParams<T>): Promise<T> {
    const attempts = this.buildVisionAttempts(basePrompt, languageInstruction);
    let lastError: Error | null = null;

    for (const attempt of attempts) {
      try {
        const content = await this.sendVisionRequest({
          prompt: attempt.prompt,
          imageBase64,
          model: attempt.model,
          purpose,
        });
        return parser(content);
      } catch (error) {
        lastError = error as Error;
        if (error instanceof OpenAIRefusalError) {
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('No analysis result received from OpenAI');
  }

  /**
   * Calculate health score based on macronutrients and quality tags
   */
  private calculateHealthScore(macros: any, qualityTags: string[]): number {
    let score = 70; // Base score

    // Adjust based on macronutrient balance
    const totalCals = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
    if (totalCals > 0) {
      const proteinPct = (macros.protein * 4 / totalCals) * 100;
      const carbsPct = (macros.carbs * 4 / totalCals) * 100;
      const fatPct = (macros.fat * 9 / totalCals) * 100;

      // Ideal ranges: Protein 20-30%, Carbs 40-50%, Fat 20-30%
      if (proteinPct >= 20 && proteinPct <= 30) score += 5;
      if (carbsPct >= 40 && carbsPct <= 50) score += 5;
      if (fatPct >= 20 && fatPct <= 30) score += 5;
    }

    // Adjust based on quality tags
    if (qualityTags.includes('high_protein')) score += 5;
    if (qualityTags.includes('whole_grain')) score += 5;
    if (qualityTags.includes('vegetable_rich')) score += 5;
    if (qualityTags.includes('ultra_processed')) score -= 10;
    if (qualityTags.includes('high_sugar')) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Parse and validate food analysis result
   */
  private parseAndValidateFoodResult(content: string): FoodAnalysisResult {
    try {
      // Clean the content - remove any markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const result = JSON.parse(cleanContent) as FoodAnalysisResult;

      // Validate required fields
      if (!result.identified_foods || !Array.isArray(result.identified_foods) ||
        !result.macronutrients || typeof result.confidence !== 'number') {
        throw new Error('Invalid food analysis result structure');
      }

      // Validate macronutrients
      const macroKeys = ['carbohydrates', 'proteins', 'fats', 'calories'];
      for (const key of macroKeys) {
        if (typeof result.macronutrients[key] !== 'number' || result.macronutrients[key] < 0) {
          throw new Error(`Invalid macronutrient value for ${key}`);
        }
      }

      // Validate optional health score
      if (result.health_score !== undefined &&
        (typeof result.health_score !== 'number' || result.health_score < 0 || result.health_score > 100)) {
        throw new Error('Health score must be between 0 and 100');
      }

      // Validate confidence
      if (result.confidence < 0 || result.confidence > 1) {
        throw new Error('Confidence must be between 0 and 1');
      }

      // Ensure arrays exist and have reasonable lengths
      result.identified_foods = result.identified_foods || [];
      result.recommendations = result.recommendations || [];
      result.observations = result.observations || [];
      result.version = result.version || this.version;

      // Ensure optional fields are properly initialized
      if (!result.vitamins) {
        result.vitamins = {};
      }
      if (!result.minerals) {
        result.minerals = {};
      }

      return result;
    } catch (error) {
      console.error('Failed to parse food analysis result:', error);
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  /**
   * Check if service is properly initialized
   */
  isInitialized(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get API key status (without exposing the key)
   */
  getApiKeyStatus(): { configured: boolean; valid: boolean } {
    return {
      configured: !!this.apiKey,
      valid: this.isInitialized() && !!this.apiKey,
    };
  }

  /**
   * Generate text analysis using OpenAI
   */
  async generateTextAnalysis(prompt: string): Promise<{
    success: boolean;
    analysis?: string;
    error?: string;
  }> {
    try {
      if (!this.isInitialized()) {
        return {
          success: false,
          error: 'OpenAI service not initialized'
        };
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Sei un assistente AI esperto in analisi del benessere e salute. Fornisci analisi dettagliate, personalizzate e pratiche basate sui dati forniti. Sii empatico, professionale e fornisci consigli utili e specifici.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        return {
          success: true,
          analysis: data.choices[0].message.content
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format from OpenAI'
        };
      }
    } catch (error) {
      console.error('Error generating text analysis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Build historical context string for emotion analysis prompt
   * Fetches last 7 analyses and computes baseline for comparison
   */
  async buildHistoricalContext(userId: string): Promise<string> {
    try {
      const history = await EmotionAnalysisService.getEmotionHistory(userId, 7);

      if (history.length < 2) {
        // Not enough data for meaningful comparison
        return '';
      }

      // Calculate averages from history (excluding the most recent which is the current one)
      const historicalData = history.slice(1); // Skip current analysis
      const avgValence = historicalData.reduce((sum, a) => sum + a.valence, 0) / historicalData.length;
      const avgArousal = historicalData.reduce((sum, a) => sum + a.arousal, 0) / historicalData.length;

      // Calculate dominant emotion distribution
      const emotionCounts: Record<string, number> = {};
      historicalData.forEach(a => {
        emotionCounts[a.dominant_emotion] = (emotionCounts[a.dominant_emotion] || 0) + 1;
      });
      const sortedEmotions = Object.entries(emotionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([emotion, count]) => `${emotion} (${Math.round(count / historicalData.length * 100)}%)`);

      // Get trend from service
      const context = await EmotionAnalysisService.getEmotionContextForAI(userId);
      const trendText = context.trend === 'improving' ? 'migliorando' :
        context.trend === 'declining' ? 'peggiorando' : 'stabile';

      // 🆕 Extract contextual data from recent analyses (sleep, activity, stress patterns)
      let contextualPatterns = '';
      const analysesWithContext = historicalData.filter(a =>
        a.analysis_data?.contextual_data?.sleep ||
        a.analysis_data?.contextual_data?.activity ||
        a.analysis_data?.contextual_data?.stress
      );

      if (analysesWithContext.length > 0) {
        // Count patterns
        const sleepCounts: Record<string, number> = {};
        const activityCounts: Record<string, number> = {};
        const stressCounts: Record<string, number> = {};

        analysesWithContext.forEach(a => {
          const ctx = a.analysis_data?.contextual_data;
          if (ctx?.sleep) sleepCounts[ctx.sleep] = (sleepCounts[ctx.sleep] || 0) + 1;
          if (ctx?.activity) activityCounts[ctx.activity] = (activityCounts[ctx.activity] || 0) + 1;
          if (ctx?.stress) stressCounts[ctx.stress] = (stressCounts[ctx.stress] || 0) + 1;
        });

        const mostCommonSleep = Object.entries(sleepCounts).sort((a, b) => b[1] - a[1])[0];
        const mostCommonActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0];
        const mostCommonStress = Object.entries(stressCounts).sort((a, b) => b[1] - a[1])[0];

        contextualPatterns = `
CONTEXTUAL PATTERNS (from user's self-reports):
- Most common sleep quality: ${mostCommonSleep ? mostCommonSleep[0] : 'unknown'}
- Most common activity before check-in: ${mostCommonActivity ? mostCommonActivity[0] : 'unknown'}
- Most common stress level: ${mostCommonStress ? mostCommonStress[0] : 'unknown'}

Use these patterns to:
1. Correlate emotional state with sleep quality (e.g., "quando dormi meno di 5h, la tua valence tende a essere più bassa")
2. Suggest relevant activities based on what works for this user
3. Acknowledge stress patterns and provide targeted recommendations
`;
      }

      // 🆕 Convert to 0-100 scale for display in text
      const avgValence0100 = Math.round(((avgValence + 1) / 2) * 100);
      const avgArousal0100 = Math.round(((avgArousal + 1) / 2) * 100);

      return `

----------------------------------------------------------------------
HISTORICAL CONTEXT (USE CAREFULLY)
----------------------------------------------------------------------

The user has ${historicalData.length} PREVIOUS check-ins (excluding this current one).

PREVIOUS BASELINE (for comparison with TODAY's analysis):
- previous_mood_score_0_100: ${avgValence0100} (50 = neutral, 0 = very negative, 100 = very positive)
- previous_energy_score_0_100: ${avgArousal0100} (50 = neutral, 0 = very calm/low, 100 = very activated/high)
- dominant emotions in past sessions: ${sortedEmotions.join(', ')}
- overall trend: ${context.trend} (${trendText})

${contextualPatterns} 

INSTRUCTIONS:
- Keep numeric JSON fields:
  - "valence" in [-1, 1]
  - "arousal" in [-1, 1]
- You MAY compare TODAY's detected values to the PREVIOUS baseline in "analysis_description".
- Use phrases like "rispetto alle tue sessioni precedenti" or "compared to your recent sessions".
- Do NOT show raw numbers like "47" - instead say "leggermente sopra/sotto la tua media recente".
- If today seems meaningfully higher/lower than the baseline, mention it briefly (one sentence max).
- Do not invent causal explanations. Use cautious language.
`;
    } catch (error) {
      console.error('Error building historical context:', error);
      return ''; // Return empty string on error - analysis continues without context
    }
  }
}

export default OpenAIAnalysisService;

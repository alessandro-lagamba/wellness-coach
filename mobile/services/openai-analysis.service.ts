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

export class OpenAIAnalysisService {
  private static instance: OpenAIAnalysisService;
  private apiKey: string | null = null;
  private baseUrl: string = API_CONFIG.OPENAI.BASE_URL;
  private readonly version = '1.0.0';

  // Prompts esatti come specificati dall'utente
  private readonly EMOTION_DETECTION_PROMPT = `You are an expert in facial emotion analysis for wellness coaching.
Task: analyze ONE face photo and return STRICT JSON that matches the provided JSON Schema.
Constraints:
- Estimate 7 basic emotions + dominant_emotion, valence (-1..1), arousal (-1..1), confidence (0..1).
- Base judgement on visible facial cues only (brows, eyes, mouth). Do NOT infer from background.
- Observations: describe specific facial cues (e.g., "corners of mouth raised", "eyebrows relaxed", "eyes wide open"). Be objective.
- Recommendations: provide 3-5 short, actionable wellness tips based on the detected emotion (e.g., "Take a deep breath", "Go for a short walk").
- Analysis Description: Provide a short, educational paragraph (2-3 sentences) explaining the analysis result to the user. Explain "why" this emotion was detected and what it means for their wellness. Focus on the science of facial expressions (e.g., "The raised inner eyebrows suggest...").

Schema: {
  "type": "object",
  "required": ["dominant_emotion","emotions","valence","arousal","confidence","observations","recommendations","analysis_description","version"],
  "properties": {
    "dominant_emotion": {"type":"string","enum":["joy","sadness","anger","fear"," surprise","disgust","neutral"]},
    "emotions": {
      "type":"object",
      "required":["joy","sadness","anger","fear","surprise","disgust","neutral"],
      "properties": {
        "joy":{"type":"number","minimum":0,"maximum":1},
        "sadness":{"type":"number","minimum":0,"maximum":1},
        "anger":{"type":"number","minimum":0,"maximum":1},
        "fear":{"type":"number","minimum":0,"maximum":1},
        "surprise":{"type":"number","minimum":0,"maximum":1},
        "disgust":{"type":"number","minimum":0,"maximum":1},
        "neutral":{"type":"number","minimum":0,"maximum":1}
      }
    },
    "valence":{"type":"number","minimum":-1,"maximum":1},
    "arousal":{"type":"number","minimum":-1,"maximum":1},
    "confidence":{"type":"number","minimum":0,"maximum":1},
    "observations":{"type":"array","items":{"type":"string"}, "maxItems":5},
    "recommendations":{"type":"array","items":{"type":"string"}, "maxItems":5},
    "analysis_description":{"type":"string"},
    "version":{"type":"string"}
  }
}`;

  private readonly SKIN_ANALYSIS_PROMPT = `You are a dermatology-assistant focused on non-diagnostic cosmetic skin assessment from a single photo.
Task: analyze the skin quality (texture, redness, oiliness, hydration) and return STRICT JSON per schema.
Constraints:
- Consider lighting, focus, and visible areas. If artifacts (makeup/filters/overexposure) reduce confidence.
- Provide concise product-agnostic recommendations (hydration, sunscreen, cleansing, etc.). Non-medical.
- Analysis Description: Provide a short, educational paragraph (2-3 sentences) explaining the skin condition to the user. Explain what the scores mean and offer a general wellness tip. Focus on skin physiology (e.g., "Sebum production appears balanced...").

Schema: {
  "type":"object",
  "required":["scores","issues","recommendations","confidence","notes","analysis_description","version"],
  "properties":{
    " scores":{
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

  private readonly FOOD_ANALYSIS_PROMPT = `You are a nutrition expert analyzing food from a photo for wellness coaching.
  Task: identify foods, estimate macronutrients, vitamins, minerals, and provide health insights.Return STRICT JSON per schema.
    Constraints:
- Identify all visible foods accurately.Estimate portions based on typical serving sizes.
- Calculate macronutrients(carbs, proteins, fats, fiber, calories) in grams / kcal.
- Estimate key vitamins(A, C, D, E, K, B - complex) and minerals(calcium, iron, magnesium, potassium, sodium, zinc) when identifiable.
- Determine meal type(breakfast / lunch / dinner / snack / other) based on foods and context.
- Provide health score(0 - 100) based on nutritional balance, variety, and quality.
- If portions are unclear or foods partially hidden, lower confidence and explain in observations.

Return ONLY JSON.No prose.No code fences.
  Schema: {
  "type": "object",
    "required": ["identified_foods", "macronutrients", "recommendations", "observations", "confidence", "version"],
      "properties": {
    "identified_foods": { "type": "array", "items": { "type": "string" } },
    "macronutrients": {
      "type": "object",
        "required": ["carbohydrates", "proteins", "fats", "calories"],
          "properties": {
        "carbohydrates": { "type": "number", "minimum": 0 },
        "proteins": { "type": "number", "minimum": 0 },
        "fats": { "type": "number", "minimum": 0 },
        "fiber": { "type": "number", "minimum": 0 },
        "calories": { "type": "number", "minimum": 0 }
      }
    },
    "vitamins": {
      "type": "object",
        "properties": {
        "vitamin_a": { "type": "number", "minimum": 0 },
        "vitamin_c": { "type": "number", "minimum": 0 },
        "vitamin_d": { "type": "number", "minimum": 0 },
        "vitamin_e": { "type": "number", "minimum": 0 },
        "vitamin_k": { "type": "number", "minimum": 0 },
        "thiamine": { "type": "number", "minimum": 0 },
        "riboflavin": { "type": "number", "minimum": 0 },
        "niacin": { "type": "number", "minimum": 0 },
        "vitamin_b6": { "type": "number", "minimum": 0 },
        "folate": { "type": "number", "minimum": 0 },
        "vitamin_b12": { "type": "number", "minimum": 0 }
      }
    },
    "minerals": {
      "type": "object",
        "properties": {
        "calcium": { "type": "number", "minimum": 0 },
        "iron": { "type": "number", "minimum": 0 },
        "magnesium": { "type": "number", "minimum": 0 },
        "phosphorus": { "type": "number", "minimum": 0 },
        "potassium": { "type": "number", "minimum": 0 },
        "sodium": { "type": "number", "minimum": 0 },
        "zinc": { "type": "number", "minimum": 0 },
        "copper": { "type": "number", "minimum": 0 },
        "manganese": { "type": "number", "minimum": 0 },
        "selenium": { "type": "number", "minimum": 0 }
      }
    },
    "meal_type": { "type": "string", "enum": ["breakfast", "lunch", "dinner", "snack", "other"] },
    "health_score": { "type": "number", "minimum": 0, "maximum": 100 },
    "recommendations": { "type": "array", "items": { "type": "string" }, "maxItems": 6 },
    "observations": { "type": "array", "items": { "type": "string" }, "maxItems": 5 },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "version": { "type": "string" }
  }
} `;

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
      const fullPrompt = `${this.EMOTION_DETECTION_PROMPT}\n\n${languageInstruction}`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: API_CONFIG.OPENAI.MODEL,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: fullPrompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: API_CONFIG.OPENAI.MAX_TOKENS,
          temperature: API_CONFIG.OPENAI.TEMPERATURE,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No analysis result received from OpenAI');
      }

      // Parse and validate JSON response
      const analysisResult = this.parseAndValidateEmotionResult(content);

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
      const fullPrompt = `${this.SKIN_ANALYSIS_PROMPT}\n\n${languageInstruction}`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: API_CONFIG.OPENAI.MODEL,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: fullPrompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: API_CONFIG.OPENAI.MAX_TOKENS,
          temperature: API_CONFIG.OPENAI.TEMPERATURE,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No analysis result received from OpenAI');
      }

      // Parse and validate JSON response
      const analysisResult = this.parseAndValidateSkinResult(content);

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

      // Ensure arrays exist and have reasonable lengths
      result.observations = result.observations || [];
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

      // Convert image to base64
      const imageBase64 = await this.convertImageToBase64(request.imageUri);

      // Call backend nutrition API
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
      // Error logging handled by backend
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
  getApiKeyStatus(): { openai: boolean; configured: boolean } {
    return {
      openai: this.isInitialized(),
      configured: !!this.apiKey,
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
}

export default OpenAIAnalysisService;

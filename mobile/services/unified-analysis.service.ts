// Unified Analysis Service
import OpenAIAnalysisService from './openai-analysis.service';
import AnalysisStorageService from './analysis-storage.service';
import { 
  AnalysisRequest, 
  AnalysisResponse, 
  EmotionAnalysisResult, 
  SkinAnalysisResult,
  FoodAnalysisResult,
  AnalysisHistory 
} from '../types/analysis.types';

export class UnifiedAnalysisService {
  private static instance: UnifiedAnalysisService;
  private openaiService: OpenAIAnalysisService;
  private storageService: AnalysisStorageService;

  public static getInstance(): UnifiedAnalysisService {
    if (!UnifiedAnalysisService.instance) {
      UnifiedAnalysisService.instance = new UnifiedAnalysisService();
    }
    return UnifiedAnalysisService.instance;
  }

  constructor() {
    this.openaiService = OpenAIAnalysisService.getInstance();
    this.storageService = AnalysisStorageService.getInstance();
  }

  /**
   * Initialize the unified analysis service
   */
  async initialize(apiKey?: string): Promise<{
    openai: boolean;
    storage: boolean;
    overall: boolean;
  }> {
    try {
      const [openaiResult, storageResult] = await Promise.all([
        this.openaiService.initialize(apiKey),
        Promise.resolve(true), // Storage service doesn't need initialization
      ]);

      const overall = openaiResult && storageResult;

      return {
        openai: openaiResult,
        storage: storageResult,
        overall,
      };
    } catch (error) {
      console.error('Failed to initialize Unified Analysis Service:', error);
      return {
        openai: false,
        storage: false,
        overall: false,
      };
    }
  }

  /**
   * Analyze emotion from image
   */
  async analyzeEmotion(
    imageUri: string, 
    sessionId?: string
  ): Promise<AnalysisResponse<EmotionAnalysisResult>> {
    try {
      const request: AnalysisRequest = {
        imageUri,
        analysisType: 'emotion',
        sessionId,
        timestamp: new Date(),
      };

      // Perform analysis
      const result = await this.openaiService.analyzeEmotion(request);

      // Save to storage if successful
      if (result.success && result.data) {
        try {
          await this.storageService.saveAnalysis(
            'emotion',
            result.data,
            imageUri,
            sessionId
          );
        } catch (storageError) {
          console.warn('Failed to save emotion analysis to storage:', storageError);
          // If storage fails due to corruption, try emergency cleanup
          if (storageError.message?.includes('Row too big')) {
            console.log('Attempting emergency storage cleanup...');
            await this.storageService.emergencyCleanup();
          }
          // Don't fail the whole operation if storage fails
        }
      }

      return result;
    } catch (error) {
      console.error('Unified emotion analysis failed:', error);
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
  async analyzeSkin(
    imageUri: string, 
    sessionId?: string
  ): Promise<AnalysisResponse<SkinAnalysisResult>> {
    try {
      const request: AnalysisRequest = {
        imageUri,
        analysisType: 'skin',
        sessionId,
        timestamp: new Date(),
      };

      // Perform analysis
      const result = await this.openaiService.analyzeSkin(request);

      // Save to storage if successful
      if (result.success && result.data) {
        try {
          await this.storageService.saveAnalysis(
            'skin',
            result.data,
            imageUri,
            sessionId
          );
        } catch (storageError) {
          console.warn('Failed to save skin analysis to storage:', storageError);
          // Don't fail the whole operation if storage fails
        }
      }

      return result;
    } catch (error) {
      console.error('Unified skin analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Analyze food from image
   */
  async analyzeFood(
    imageUri: string, 
    sessionId?: string
  ): Promise<AnalysisResponse<FoodAnalysisResult>> {
    try {
      const request: AnalysisRequest = {
        imageUri,
        analysisType: 'food',
        sessionId,
        timestamp: new Date(),
      };

      // Perform analysis
      const result = await this.openaiService.analyzeFood(request);

      // Save to storage if successful
      if (result.success && result.data) {
        try {
          await this.storageService.saveAnalysis(
            'food',
            result.data,
            imageUri,
            sessionId
          );
        } catch (storageError) {
          console.warn('Failed to save food analysis to storage:', storageError);
          // Don't fail the whole operation if storage fails
        }
      }

      return result;
    } catch (error) {
      console.error('Unified food analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get analysis history
   */
  async getAnalysisHistory(): Promise<AnalysisHistory[]> {
    return await this.storageService.getAnalysisHistory();
  }

  /**
   * Get analysis history by type
   */
  async getAnalysisHistoryByType(type: 'emotion' | 'skin' | 'food'): Promise<AnalysisHistory[]> {
    return await this.storageService.getAnalysisHistoryByType(type);
  }

  /**
   * Get recent analyses
   */
  async getRecentAnalyses(days: number = 7): Promise<AnalysisHistory[]> {
    return await this.storageService.getRecentAnalyses(days);
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats() {
    return await this.storageService.getAnalysisStats();
  }

  /**
   * Delete analysis
   */
  async deleteAnalysis(id: string): Promise<boolean> {
    return await this.storageService.deleteAnalysis(id);
  }

  /**
   * Clear all analysis history
   */
  async clearAllHistory(): Promise<boolean> {
    return await this.storageService.clearAllHistory();
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.openaiService.isInitialized();
  }

  /**
   * Get service status
   */
  getStatus(): {
    openai: boolean;
    storage: boolean;
    ready: boolean;
    apiKeyStatus: { configured: boolean; valid: boolean };
  } {
    return {
      openai: this.openaiService.isInitialized(),
      storage: true, // Storage is always available
      ready: this.isReady(),
      apiKeyStatus: this.openaiService.getApiKeyStatus(),
    };
  }

  /**
   * Get trend analysis for emotions
   */
  async getEmotionTrends(days: number = 30): Promise<{
    dominantEmotions: { [key: string]: number };
    averageValence: number;
    averageArousal: number;
    confidenceTrend: number[];
    recommendations: string[];
  }> {
    const recentAnalyses = await this.storageService.getRecentAnalyses(days);
    const emotionAnalyses = recentAnalyses.filter(
      item => item.type === 'emotion'
    ) as AnalysisHistory[];

    if (emotionAnalyses.length === 0) {
      return {
        dominantEmotions: {},
        averageValence: 0,
        averageArousal: 0,
        confidenceTrend: [],
        recommendations: [],
      };
    }

    // Calculate dominant emotions frequency
    const dominantEmotions: { [key: string]: number } = {};
    let totalValence = 0;
    let totalArousal = 0;
    const confidenceTrend: number[] = [];
    const allRecommendations: string[] = [];

    emotionAnalyses.forEach(analysis => {
      const result = analysis.result as EmotionAnalysisResult;
      
      // Count dominant emotions
      dominantEmotions[result.dominant_emotion] = 
        (dominantEmotions[result.dominant_emotion] || 0) + 1;
      
      // Sum valence and arousal
      totalValence += result.valence;
      totalArousal += result.arousal;
      
      // Track confidence trend
      confidenceTrend.push(result.confidence);
      
      // Collect recommendations
      allRecommendations.push(...result.recommendations);
    });

    // Calculate averages
    const averageValence = totalValence / emotionAnalyses.length;
    const averageArousal = totalArousal / emotionAnalyses.length;

    // Get unique recommendations
    const uniqueRecommendations = [...new Set(allRecommendations)];

    return {
      dominantEmotions,
      averageValence,
      averageArousal,
      confidenceTrend,
      recommendations: uniqueRecommendations.slice(0, 5), // Top 5
    };
  }

  /**
   * Get trend analysis for skin
   */
  async getSkinTrends(days: number = 30): Promise<{
    averageScores: {
      texture: number;
      redness: number;
      oiliness: number;
      hydration: number;
      overall: number;
    };
    commonIssues: { [key: string]: number };
    recommendations: string[];
    confidenceTrend: number[];
  }> {
    const recentAnalyses = await this.storageService.getRecentAnalyses(days);
    const skinAnalyses = recentAnalyses.filter(
      item => item.type === 'skin'
    ) as AnalysisHistory[];

    if (skinAnalyses.length === 0) {
      return {
        averageScores: {
          texture: 0,
          redness: 0,
          oiliness: 0,
          hydration: 0,
          overall: 0,
        },
        commonIssues: {},
        recommendations: [],
        confidenceTrend: [],
      };
    }

    // Calculate average scores
    let totalTexture = 0;
    let totalRedness = 0;
    let totalOiliness = 0;
    let totalHydration = 0;
    let totalOverall = 0;
    const confidenceTrend: number[] = [];
    const allIssues: string[] = [];
    const allRecommendations: string[] = [];

    skinAnalyses.forEach(analysis => {
      const result = analysis.result as SkinAnalysisResult;
      
      // Sum scores
      totalTexture += result.scores.texture;
      totalRedness += result.scores.redness;
      totalOiliness += result.scores.oiliness;
      totalHydration += result.scores.hydration;
      totalOverall += result.scores.overall;
      
      // Track confidence trend
      confidenceTrend.push(result.confidence);
      
      // Collect issues and recommendations
      allIssues.push(...result.issues);
      allRecommendations.push(...result.recommendations);
    });

    // Calculate averages
    const count = skinAnalyses.length;
    const averageScores = {
      texture: totalTexture / count,
      redness: totalRedness / count,
      oiliness: totalOiliness / count,
      hydration: totalHydration / count,
      overall: totalOverall / count,
    };

    // Count common issues
    const commonIssues: { [key: string]: number } = {};
    allIssues.forEach(issue => {
      commonIssues[issue] = (commonIssues[issue] || 0) + 1;
    });

    // Get unique recommendations
    const uniqueRecommendations = [...new Set(allRecommendations)];

    return {
      averageScores,
      commonIssues,
      recommendations: uniqueRecommendations.slice(0, 5), // Top 5
      confidenceTrend,
    };
  }

  /**
   * Get API key status
   */
  getApiKeyStatus(): { openai: boolean; configured: boolean } {
    return this.openaiService.getApiKeyStatus();
  }

  /**
   * Generate detailed analysis using AI
   */
  async generateDetailedAnalysis(prompt: string): Promise<{
    success: boolean;
    analysis?: string;
    error?: string;
  }> {
    try {
      if (!this.openaiService.isInitialized()) {
        return {
          success: false,
          error: 'OpenAI service not initialized'
        };
      }

      const response = await this.openaiService.generateTextAnalysis(prompt);
      
      if (response.success && response.analysis) {
        return {
          success: true,
          analysis: response.analysis
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to generate analysis'
        };
      }
    } catch (error) {
      console.error('Error generating detailed analysis:', error);
      return {
        success: false,
        error: 'An error occurred while generating the analysis'
      };
    }
  }
}

export default UnifiedAnalysisService;

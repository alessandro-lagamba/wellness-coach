// Analysis Storage Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api.config';
import { AnalysisHistory, EmotionAnalysisResult, SkinAnalysisResult } from '../types/analysis.types';

export class AnalysisStorageService {
  private static instance: AnalysisStorageService;
  private readonly STORAGE_KEY = API_CONFIG.STORAGE.ANALYSIS_HISTORY_KEY;
  private readonly MAX_HISTORY_ITEMS = API_CONFIG.ANALYSIS.MAX_HISTORY_ITEMS;

  public static getInstance(): AnalysisStorageService {
    if (!AnalysisStorageService.instance) {
      AnalysisStorageService.instance = new AnalysisStorageService();
    }
    return AnalysisStorageService.instance;
  }

  /**
   * Save analysis result to storage
   */
  async saveAnalysis(
    type: 'emotion' | 'skin',
    result: EmotionAnalysisResult | SkinAnalysisResult,
    imageUri: string,
    sessionId?: string
  ): Promise<string> {
    try {
      const analysisId = this.generateAnalysisId();
      // Store minimal data to avoid AsyncStorage size issues
      const analysis: AnalysisHistory = {
        id: analysisId,
        type,
        result: {
          ...result,
          // Remove any large data fields that might cause storage issues
          base64_data: undefined,
          image_data: undefined,
          base64: undefined,
          imageUrl: undefined,
          originalImage: undefined,
        } as any,
        imageUri: imageUri.substring(0, 50), // Limit URI length further
        timestamp: new Date(),
        sessionId,
      };

      // Additional size check before storing
      const analysisJson = JSON.stringify(analysis);
      if (analysisJson.length > 100000) { // 100KB limit per entry
        console.warn(`Analysis ${analysisId} too large (${analysisJson.length} chars), skipping storage`);
        return analysisId; // Return ID but don't store
      }

      const history = await this.getAnalysisHistory();
      history.unshift(analysis); // Add to beginning

      // Keep only the most recent analyses
      if (history.length > this.MAX_HISTORY_ITEMS) {
        history.splice(this.MAX_HISTORY_ITEMS);
      }

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
      console.log(`Analysis ${analysisId} saved successfully`);
      
      return analysisId;
    } catch (error) {
      console.error('Failed to save analysis:', error);
      throw new Error('Failed to save analysis result');
    }
  }

  /**
   * Get all analysis history
   */
  async getAnalysisHistory(): Promise<AnalysisHistory[]> {
    try {
      const historyJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!historyJson) {
        return [];
      }

      // Check if the JSON data is too large and clear it if needed
      if (historyJson.length > 1000000) { // 1MB limit
        console.warn('Analysis history too large, clearing storage');
        await AsyncStorage.removeItem(this.STORAGE_KEY);
        return [];
      }

      const history = JSON.parse(historyJson) as AnalysisHistory[];
      
      // Convert timestamp strings back to Date objects
      return history.map(item => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
    } catch (error) {
      console.error('Failed to get analysis history:', error);
      // If parsing fails due to data corruption, clear storage
      if (error.message?.includes('Row too big')) {
        console.warn('Clearing corrupted analysis history');
        await AsyncStorage.removeItem(this.STORAGE_KEY);
      }
      return [];
    }
  }

  /**
   * Get analysis history by type
   */
  async getAnalysisHistoryByType(type: 'emotion' | 'skin'): Promise<AnalysisHistory[]> {
    const history = await this.getAnalysisHistory();
    return history.filter(item => item.type === type);
  }

  /**
   * Get recent analyses (last N days)
   */
  async getRecentAnalyses(days: number = 7): Promise<AnalysisHistory[]> {
    const history = await this.getAnalysisHistory();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return history.filter(item => item.timestamp >= cutoffDate);
  }

  /**
   * Get analysis by ID
   */
  async getAnalysisById(id: string): Promise<AnalysisHistory | null> {
    const history = await this.getAnalysisHistory();
    return history.find(item => item.id === id) || null;
  }

  /**
   * Delete analysis by ID
   */
  async deleteAnalysis(id: string): Promise<boolean> {
    try {
      const history = await this.getAnalysisHistory();
      const filteredHistory = history.filter(item => item.id !== id);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredHistory));
      console.log(`Analysis ${id} deleted successfully`);
      
      return true;
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      return false;
    }
  }

  /**
   * Clear all analysis history
   */
  async clearAllHistory(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('All analysis history cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear analysis history:', error);
      return false;
    }
  }

  /**
   * Emergency storage cleanup - clears corrupted storage
   */
  async emergencyCleanup(): Promise<void> {
    try {
      await AsyncStorage.clear();
      console.log('Emergency storage cleanup completed');
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats(): Promise<{
    total: number;
    emotion: number;
    skin: number;
    lastAnalysis?: Date;
    averageConfidence: number;
  }> {
    const history = await this.getAnalysisHistory();
    
    const emotionCount = history.filter(item => item.type === 'emotion').length;
    const skinCount = history.filter(item => item.type === 'skin').length;
    const lastAnalysis = history.length > 0 ? history[0].timestamp : undefined;
    
    // Calculate average confidence
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    history.forEach(item => {
      if ('confidence' in item.result) {
        totalConfidence += item.result.confidence;
        confidenceCount++;
      }
    });
    
    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return {
      total: history.length,
      emotion: emotionCount,
      skin: skinCount,
      lastAnalysis,
      averageConfidence,
    };
  }

  /**
   * Generate unique analysis ID
   */
  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export analysis history (for backup/debugging)
   */
  async exportHistory(): Promise<string> {
    const history = await this.getAnalysisHistory();
    return JSON.stringify(history, null, 2);
  }

  /**
   * Import analysis history (for restore)
   */
  async importHistory(historyJson: string): Promise<boolean> {
    try {
      const history = JSON.parse(historyJson) as AnalysisHistory[];
      
      // Validate the imported data
      if (!Array.isArray(history)) {
        throw new Error('Invalid history format');
      }

      // Convert timestamp strings back to Date objects
      const processedHistory = history.map(item => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(processedHistory));
      console.log(`Imported ${history.length} analysis records`);
      
      return true;
    } catch (error) {
      console.error('Failed to import analysis history:', error);
      return false;
    }
  }
}

export default AnalysisStorageService;

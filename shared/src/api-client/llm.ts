/**
 * LLM API Adapter
 * Adapter for existing LLM integration (GPT-4o-mini)
 */

import { ChatMessage, EmotionContext, EmotionAnalysis } from '../types';
import { API_ENDPOINTS } from '../utils/constants';

// ========================================
// LLM ADAPTER INTERFACE
// ========================================

export interface LLMAdapter {
  generateResponse(
    message: string,
    context: LLMContext
  ): Promise<LLMResponse>;
  
  generateWellnessCoaching(
    userInput: string,
    wellnessContext: WellnessContext
  ): Promise<WellnessCoachingResponse>;
}

// ========================================
// LLM TYPES
// ========================================

export interface LLMContext {
  emotionContext?: EmotionContext;
  messageHistory?: ChatMessage[];
  userProfile?: {
    name?: string;
    age?: number;
    skinType?: string;
    concerns?: string[];
    goals?: string[];
  };
  sessionContext?: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    location?: string;
    weather?: string;
  };
}

export interface LLMResponse {
  message: string;
  suggestions?: string[];
  emotionBasedAdvice?: string;
  expression?: {
    smile: number;
    browUp: number;
    browDown: number;
    eyeWide: number;
    frown: number;
  };
  metadata?: {
    model: string;
    tokens: number;
    confidence: number;
  };
}

export interface WellnessContext {
  skinAnalysis?: {
    brightness: number;
    uniformity: number;
    redness: number;
    recommendations: string[];
  };
  emotionState?: EmotionContext;
  biometricData?: {
    heartRate?: number;
    sleepHours?: number;
    stressLevel?: number;
  };
  environmentalData?: {
    uvIndex?: number;
    humidity?: number;
    temperature?: number;
  };
  goals?: string[];
  preferences?: {
    style: 'supportive' | 'direct' | 'scientific' | 'motivational';
    topics: string[];
    language: string;
  };
}

export interface WellnessCoachingResponse extends LLMResponse {
  coachingType: 'skincare' | 'mental_health' | 'lifestyle' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionItems: {
    title: string;
    description: string;
    timeframe: string;
    difficulty: 'easy' | 'moderate' | 'challenging';
  }[];
  followUpQuestions?: string[];
}

// ========================================
// EXISTING BACKEND ADAPTER
// ========================================

export class ExistingLLMAdapter implements LLMAdapter {
  constructor(
    private baseUrl: string = 'http://localhost:3001',
    private apiKey?: string
  ) {}

  async generateResponse(
    message: string,
    context: LLMContext
  ): Promise<LLMResponse> {
    try {
      // Adapt to existing backend API format
      const payload = {
        message,
        emotionContext: context.emotionContext,
        messageHistory: context.messageHistory?.map(msg => ({
          role: msg.role,
          content: msg.content
        })) || [],
        model: 'gpt-4o-mini'
      };

      const response = await fetch(`${this.baseUrl}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No API key needed - handled by backend
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const rawData = await response.json();
      const data = rawData as { 
        message?: string; 
        suggestions?: string[]; 
        emotionBasedAdvice?: string; 
        expression?: any;
        tokens?: number;
        confidence?: number;
      };
      
      return {
        message: data.message || 'No response received',
        suggestions: data.suggestions || [],
        emotionBasedAdvice: data.emotionBasedAdvice,
        expression: data.expression,
        metadata: {
          model: 'gpt-4o-mini',
          tokens: data.tokens || 0,
          confidence: data.confidence || 0.9
        }
      };
    } catch (error) {
      console.error('[LLM Adapter] Error:', error);
      throw error;
    }
  }

  async generateWellnessCoaching(
    userInput: string,
    wellnessContext: WellnessContext
  ): Promise<WellnessCoachingResponse> {
    // Enhanced prompt for wellness coaching
    const enhancedPrompt = this.buildWellnessPrompt(userInput, wellnessContext);
    
    const basicResponse = await this.generateResponse(enhancedPrompt, {
      emotionContext: wellnessContext.emotionState,
      userProfile: {
        skinType: wellnessContext.skinAnalysis ? 'analyzed' : undefined,
        concerns: this.extractConcerns(wellnessContext),
        goals: wellnessContext.goals
      }
    });

    // Transform basic response to wellness coaching response
    return {
      ...basicResponse,
      coachingType: this.determineCoachingType(wellnessContext),
      priority: this.determinePriority(wellnessContext),
      actionItems: this.extractActionItems(basicResponse.message),
      followUpQuestions: this.generateFollowUpQuestions(wellnessContext)
    };
  }

  private buildWellnessPrompt(userInput: string, context: WellnessContext): string {
    let prompt = `Come wellness coach esperto, analizza questa richiesta: "${userInput}"\n\n`;
    
    // Add skin analysis context
    if (context.skinAnalysis) {
      prompt += `Analisi della pelle:
- Luminosità: ${context.skinAnalysis.brightness}/100
- Uniformità: ${context.skinAnalysis.uniformity}/100
- Rossore: ${context.skinAnalysis.redness}/100
- Raccomandazioni: ${context.skinAnalysis.recommendations.join(', ')}\n\n`;
    }
    
    // Add emotion context
    if (context.emotionState) {
      prompt += `Stato emotivo: ${context.emotionState.dominantEmotion} (valenza: ${context.emotionState.valence}, attivazione: ${context.emotionState.arousal})\n\n`;
    }
    
    // Add environmental context
    if (context.environmentalData) {
      prompt += `Condizioni ambientali:`;
      if (context.environmentalData.uvIndex) prompt += ` UV: ${context.environmentalData.uvIndex}`;
      if (context.environmentalData.humidity) prompt += ` Umidità: ${context.environmentalData.humidity}%`;
      if (context.environmentalData.temperature) prompt += ` Temp: ${context.environmentalData.temperature}°C`;
      prompt += '\n\n';
    }
    
    // Add goals context
    if (context.goals && context.goals.length > 0) {
      prompt += `Obiettivi utente: ${context.goals.join(', ')}\n\n`;
    }
    
    prompt += `Fornisci consigli personalizzati, pratici e evidence-based. Includi azioni specifiche con tempistiche.`;
    
    return prompt;
  }

  private extractConcerns(context: WellnessContext): string[] {
    const concerns: string[] = [];
    
    if (context.skinAnalysis) {
      if (context.skinAnalysis.brightness < 40) concerns.push('pelle spenta');
      if (context.skinAnalysis.uniformity < 50) concerns.push('disuniformità');
      if (context.skinAnalysis.redness > 60) concerns.push('rossori');
    }
    
    if (context.emotionState?.dominantEmotion === 'stress') {
      concerns.push('stress');
    }
    
    return concerns;
  }

  private determineCoachingType(context: WellnessContext): WellnessCoachingResponse['coachingType'] {
    if (context.skinAnalysis) return 'skincare';
    if (context.emotionState && ['stress', 'sadness', 'anger'].includes(context.emotionState.dominantEmotion)) {
      return 'mental_health';
    }
    if (context.biometricData) return 'lifestyle';
    return 'general';
  }

  private determinePriority(context: WellnessContext): WellnessCoachingResponse['priority'] {
    // High priority for stress or skin issues
    if (context.emotionState?.dominantEmotion === 'stress') return 'high';
    if (context.skinAnalysis?.redness && context.skinAnalysis.redness > 70) return 'high';
    if (context.environmentalData?.uvIndex && context.environmentalData.uvIndex > 8) return 'urgent';
    
    return 'medium';
  }

  private extractActionItems(message: string): WellnessCoachingResponse['actionItems'] {
    // Simple extraction - in production, this could be enhanced with NLP
    const actionItems: WellnessCoachingResponse['actionItems'] = [];
    
    // Look for numbered lists or bullet points
    const lines = message.split('\n');
    let currentItem: any = null;
    
    for (const line of lines) {
      if (line.match(/^\d+\.|\-|\•/)) {
        if (currentItem) actionItems.push(currentItem);
        
        currentItem = {
          title: line.replace(/^\d+\.|\-|\•/, '').trim(),
          description: '',
          timeframe: 'oggi',
          difficulty: 'easy' as const
        };
      } else if (currentItem && line.trim()) {
        currentItem.description += line.trim() + ' ';
      }
    }
    
    if (currentItem) actionItems.push(currentItem);
    
    return actionItems.length > 0 ? actionItems : [{
      title: 'Segui i consigli',
      description: message.substring(0, 100) + '...',
      timeframe: 'oggi',
      difficulty: 'easy'
    }];
  }

  private generateFollowUpQuestions(context: WellnessContext): string[] {
    const questions: string[] = [];
    
    if (context.skinAnalysis) {
      questions.push('Come ti senti riguardo alla tua routine skincare attuale?');
      questions.push('Hai notato miglioramenti recentemente?');
    }
    
    if (context.emotionState?.dominantEmotion === 'stress') {
      questions.push('Cosa ti sta causando più stress in questo momento?');
      questions.push('Hai provato tecniche di rilassamento prima?');
    }
    
    if (questions.length === 0) {
      questions.push('C\'è qualcosa di specifico su cui vuoi lavorare?');
      questions.push('Come posso aiutarti meglio nel tuo percorso di benessere?');
    }
    
    return questions.slice(0, 2); // Max 2 follow-up questions
  }
}

// ========================================
// FACTORY & SINGLETON
// ========================================

let llmAdapterInstance: LLMAdapter | null = null;

export function createLLMAdapter(config?: {
  baseUrl?: string;
  apiKey?: string;
  type?: 'existing' | 'openai' | 'anthropic';
}): LLMAdapter {
  if (!llmAdapterInstance) {
    // For now, always use existing backend adapter
    llmAdapterInstance = new ExistingLLMAdapter(
      config?.baseUrl,
      config?.apiKey
    );
  }
  
  return llmAdapterInstance;
}

export function getLLMAdapter(): LLMAdapter {
  if (!llmAdapterInstance) {
    return createLLMAdapter();
  }
  
  return llmAdapterInstance;
}

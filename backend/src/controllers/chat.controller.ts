/**
 * Chat Controller - LLM Integration
 * Handles chat requests with emotion context
 */

import { Request, Response } from 'express';
import { generateWellnessResponse, ChatMessage } from '../services/llm.service';

export const respondToChat = async (req: Request, res: Response) => {
  try {
    const { 
      message, 
      sessionId, 
      context, 
      emotionContext, 
      skinContext, 
      userContext,
      userId,
      analysisIntent,
      tone,
      responseLength,
      includeActionSteps
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string'
      });
    }

    console.log('[Chat] 💬 Processing message:', {
      messageLength: message.length,
      hasContext: !!context,
      hasEmotion: !!emotionContext,
      hasSkin: !!skinContext,
      hasUserContext: !!userContext,
      hasAnalysisIntent: !!analysisIntent,
      analysisIntent: analysisIntent,
      userId: userId || 'anonymous',
      sessionId: sessionId || 'new'
    });

    // Extract message history if provided
    const messageHistory: ChatMessage[] = req.body.messageHistory || [];

    // Generate real LLM response with complete context
    const responseText = await generateWellnessResponse(message, messageHistory, {
      emotionContext,
      skinContext,
      userContext,
      analysisIntent,
      tone,
      responseLength,
      includeActionSteps,
      model: req.body.model || 'gpt-4o-mini'
    });

    // Generate session ID if not provided
    const responseSessionId = sessionId || `session_${Date.now()}`;

    res.json({
      success: true,
      text: responseText,
      message: responseText, // Support both formats
      sessionId: responseSessionId,
      meta: {
        timestamp: new Date().toISOString(),
        emotionContext: emotionContext?.dominantEmotion || 'neutral',
        skinContext: skinContext?.overallScore || null,
        hasUserHistory: !!(userContext?.emotionHistory?.length || userContext?.skinHistory?.length),
        model: 'wellness-coach-v2'
      }
    });

  } catch (error) {
    console.error('[Chat] ❌ Error processing message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message'
    });
  }
};


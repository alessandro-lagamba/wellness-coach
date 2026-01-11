/**
 * Chat Controller - LLM Integration
 * Handles chat requests with emotion context
 */

import { Request, Response } from 'express';
import { generateWellnessResponse, ChatMessage } from '../services/llm.service';
import { searchJournalEntries } from '../services/embedding.service';

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

    // 🆕 RAG: Search diary entries for relevant context
    let enrichedUserContext = { ...userContext };

    if (userId) {
      try {
        // 🆕 RAG: Search diary entries for relevant context (lowered threshold to 0.35)
        const journalResults = await searchJournalEntries(message, userId, 5, 0.35);

        console.log('[Chat] 📔 Search results:', journalResults.length > 0
          ? `Found ${journalResults.length} relevant entries`
          : 'No relevant entries found'
        );

        // Always provide journal context structure so AI knows it HAS access but found nothing
        enrichedUserContext = {
          ...userContext,
          journalContext: {
            searchQuery: message,
            relevantEntries: journalResults.map(entry => ({
              date: entry.entry_date,
              content: entry.content,
              aiAnalysis: entry.ai_analysis,
              similarity: entry.similarity
            }))
          }
        };
      } catch (searchError) {
        console.log('[Chat] ⚠️ Diary search failed (non-blocking):', searchError);
        // Continue without diary context - non-blocking error
      }
    }

    // Generate real LLM response with complete context
    const responseText = await generateWellnessResponse(message, messageHistory, {
      emotionContext,
      skinContext,
      userContext: enrichedUserContext,
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
        hasJournalContext: !!(enrichedUserContext?.journalContext?.relevantEntries?.length),
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



import express, { Request, Response } from 'express';
import { LiveKitAgentService } from '../services/livekit-agent.service';

const router: express.Router = express.Router();

// Initialize agent service
const agentService = new LiveKitAgentService({
  livekitUrl: process.env.LIVEKIT_URL || '',
  livekitApiKey: process.env.LIVEKIT_API_KEY || '',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  googleApiKey: process.env.GOOGLE_API_KEY || '', // Use GOOGLE_API_KEY
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
});

/**
 * POST /api/agent/start
 * Start voice chat session
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { roomName, participantId } = req.body;

    if (!roomName || !participantId) {
      return res.status(400).json({
        success: false,
        error: 'Room name and participant ID are required'
      });
    }

    console.log(`[Agent API] 🚀 Starting voice chat for ${participantId} in room ${roomName}`);

    const success = await agentService.startVoiceChat(roomName, participantId);

    if (success) {
      res.json({
        success: true,
        message: 'Voice chat started successfully',
        roomName,
        participantId
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to start voice chat'
      });
    }

  } catch (error) {
    console.error('[Agent API] ❌ Error starting voice chat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/agent/stop
 * Stop voice chat session
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        error: 'Participant ID is required'
      });
    }

    console.log(`[Agent API] 🛑 Stopping voice chat for ${participantId}`);

    await agentService.stopVoiceChat(participantId);

    res.json({
      success: true,
      message: 'Voice chat stopped successfully',
      participantId
    });

  } catch (error) {
    console.error('[Agent API] ❌ Error stopping voice chat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/agent/status/:participantId
 * Get session status
 */
router.get('/status/:participantId', async (req: Request, res: Response) => {
  try {
    const { participantId } = req.params;

    const session = agentService.getSessionStatus(participantId);

    if (session) {
      res.json({
        success: true,
        session: {
          ...session,
          duration: Date.now() - session.startTime.getTime(),
          lastActivityAgo: Date.now() - session.lastActivity.getTime()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

  } catch (error) {
    console.error('[Agent API] ❌ Error getting session status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/agent/sessions
 * Get all active sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const sessions = agentService.getAllSessions();

    res.json({
      success: true,
      sessions: sessions.map(session => ({
        ...session,
        duration: Date.now() - session.startTime.getTime(),
        lastActivityAgo: Date.now() - session.lastActivity.getTime()
      }))
    });

  } catch (error) {
    console.error('[Agent API] ❌ Error getting sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/agent/health
 * Health check for agent service
 */
router.get('/health', (req: Request, res: Response) => {
  const hasConfig = !!(
    process.env.LIVEKIT_URL && 
    process.env.LIVEKIT_API_KEY && 
    process.env.LIVEKIT_API_SECRET &&
    process.env.DEEPGRAM_API_KEY &&
    process.env.GOOGLE_API_KEY && // Use GOOGLE_API_KEY
    process.env.ELEVENLABS_API_KEY
  );
  
  res.json({
    success: true,
    service: 'LiveKit Agent Service',
    configured: hasConfig,
    activeSessions: agentService.getAllSessions().length,
    timestamp: new Date().toISOString(),
  });
});

export default router;

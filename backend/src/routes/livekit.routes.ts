import express from 'express';
import { AccessToken } from 'livekit-server-sdk';

const router = express.Router();

// 🆕 Store room context temporarily (in production use Redis/cache)
const roomContextStore = new Map<string, any>();

// Generate LiveKit access token for voice chat
router.post('/token', async (req, res) => {
  try {
    const { roomName, identity, metadata } = req.body;

    // Validate required fields
    if (!roomName || !identity) {
      return res.status(400).json({
        success: false,
        error: 'Room name and identity are required'
      });
    }

    // Get LiveKit configuration from environment
    const livekitUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitUrl || !apiKey || !apiSecret) {
      return res.status(500).json({
        success: false,
        error: 'LiveKit configuration missing'
      });
    }

    // Create access token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: identity,
      ttl: '1h', // Token valid for 1 hour
    });

    // Grant permissions
    const grant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    };

    // 🆕 Parse metadata if provided and add to room configuration
    let roomMetadata = metadata;
    try {
      if (typeof metadata === 'string') {
        roomMetadata = JSON.parse(metadata);
      }
      
      // Log context being passed
      if (roomMetadata?.userContext || roomMetadata?.emotionContext || roomMetadata?.skinContext) {
        console.log(`[LiveKit] ✅ Passing user context to agent:`, {
          hasUserContext: !!roomMetadata.userContext,
          hasEmotionContext: !!roomMetadata.emotionContext,
          hasSkinContext: !!roomMetadata.skinContext,
          userId: roomMetadata.userId,
          // 🆕 Log firstName/userName for debugging
          firstName: roomMetadata.userContext?.firstName,
          userName: roomMetadata.userContext?.userName,
        });
        
        // 🆕 Store context for agent to retrieve (keyed by room name)
        roomContextStore.set(roomName, {
          userContext: roomMetadata.userContext,
          emotionContext: roomMetadata.emotionContext,
          skinContext: roomMetadata.skinContext,
          userId: roomMetadata.userId,
          timestamp: Date.now(),
        });
        
        // Cleanup after 2 hours (room context expires)
        setTimeout(() => {
          roomContextStore.delete(roomName);
        }, 2 * 60 * 60 * 1000);
      }
    } catch (e) {
      console.warn('[LiveKit] Failed to parse metadata, using as-is');
    }

    token.addGrant(grant);

    // Generate JWT token
    const jwt = await token.toJwt();

    console.log(`[LiveKit] Generated token for ${identity} in room ${roomName}`);
    console.log(`[LiveKit] Agent will auto-connect when participant joins the room`);

    res.json({
      success: true,
      token: jwt,
      url: livekitUrl,
      roomName: roomName,
      identity: identity,
      // 🆕 Return metadata so agent can access it (agent will read from room)
      metadata: roomMetadata,
    });

  } catch (error) {
    console.error('[LiveKit] Token generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate LiveKit token'
    });
  }
});

// 🆕 Get room context for agent (called by Python agent)
router.get('/context/:roomName', (req, res) => {
  try {
    const { roomName } = req.params;
    const context = roomContextStore.get(roomName);
    
    if (!context) {
      return res.json({
        success: true,
        context: null,
        message: 'No context found for this room',
      });
    }
    
    res.json({
      success: true,
      context: context,
    });
  } catch (error) {
    console.error('[LiveKit] Error retrieving room context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve room context',
    });
  }
});

// Health check for LiveKit service
router.get('/health', (req, res) => {
  const hasConfig = !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
  
  res.json({
    success: true,
    service: 'LiveKit Token Service',
    configured: hasConfig,
    timestamp: new Date().toISOString(),
  });
});

export default router;

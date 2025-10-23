/**
 * Avatar Controller - Secure Token-Based Avatar Services
 * Handles Simli, A2E, and RPM avatar services securely
 */

import { Request, Response } from 'express';
import axios from 'axios';

// ========================================
// SIMLI AVATAR ENDPOINTS
// ========================================

export const getSimliToken = async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.SIMLI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Simli API key not configured'
      });
    }

    // Generate ephemeral token for client
    const tokenResponse = await axios.post('https://api.simli.com/v1/token', {
      // Token generation parameters
      expiresIn: '1h',
      permissions: ['avatar:connect', 'avatar:speak']
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      data: {
        token: tokenResponse.data.token,
        expiresAt: tokenResponse.data.expiresAt,
        avatarId: process.env.SIMLI_DEFAULT_AVATAR_ID || 'd2a5c7c6-fed9-4f55-bcb3-062f7cd20103',
        wsUrl: 'wss://api.simli.ai'
      }
    });

  } catch (error) {
    console.error('[Avatar] Simli token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Simli token'
    });
  }
};

export const simliSpeak = async (req: Request, res: Response) => {
  try {
    const { text, voice, language = 'it' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const apiKey = process.env.SIMLI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Simli API key not configured'
      });
    }

    // Proxy request to Simli with secure API key
    const speakResponse = await axios.post('https://api.simli.com/v1/speak', {
      text,
      voice: voice || process.env.SIMLI_DEFAULT_VOICE_ID,
      language,
      avatarId: process.env.SIMLI_DEFAULT_AVATAR_ID
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      data: speakResponse.data
    });

  } catch (error) {
    console.error('[Avatar] Simli speak error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process speech request'
    });
  }
};

// ========================================
// A2E AVATAR ENDPOINTS
// ========================================

export const getA2EToken = async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.A2E_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'A2E API key not configured'
      });
    }

    // Generate A2E token
    const tokenResponse = await axios.post(`${process.env.A2E_BASE_URL}/auth/token`, {
      expiresIn: 3600 // 1 hour
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      data: {
        token: tokenResponse.data.token,
        expiresAt: tokenResponse.data.expiresAt,
        baseUrl: process.env.A2E_BASE_URL
      }
    });

  } catch (error) {
    console.error('[Avatar] A2E token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate A2E token'
    });
  }
};

// ========================================
// READY PLAYER ME ENDPOINTS
// ========================================

export const generateRPMAvatar = async (req: Request, res: Response) => {
  try {
    const { config } = req.body;
    
    const apiKey = process.env.RPM_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Ready Player Me API key not configured'
      });
    }

    // Generate RPM avatar with secure API key
    const avatarResponse = await axios.post('https://api.readyplayer.me/v1/avatars', {
      ...config,
      subdomain: process.env.RPM_SUBDOMAIN
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      data: {
        avatarUrl: avatarResponse.data.avatarUrl,
        modelUrl: avatarResponse.data.modelUrl,
        id: avatarResponse.data.id
      }
    });

  } catch (error) {
    console.error('[Avatar] RPM generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate avatar'
    });
  }
};

// ========================================
// AVATAR STATUS & HEALTH
// ========================================

export const getAvatarStatus = async (req: Request, res: Response) => {
  try {
    const services = {
      simli: {
        available: !!process.env.SIMLI_API_KEY,
        configured: !!(process.env.SIMLI_API_KEY && process.env.SIMLI_BASE_URL)
      },
      a2e: {
        available: !!process.env.A2E_API_KEY,
        configured: !!(process.env.A2E_API_KEY && process.env.A2E_BASE_URL)
      },
      rpm: {
        available: !!process.env.RPM_KEY,
        configured: !!(process.env.RPM_KEY && process.env.RPM_SUBDOMAIN)
      }
    };

    res.json({
      success: true,
      data: {
        services,
        recommendedForPlatform: {
          web: services.simli.available ? 'simli' : 'placeholder',
          mobile: services.rpm.available ? 'three' : 'placeholder'
        }
      }
    });

  } catch (error) {
    console.error('[Avatar] Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check avatar services status'
    });
  }
};

// ========================================
// RATE LIMITING & SECURITY
// ========================================

export const validateAvatarRequest = (req: Request, res: Response, next: any) => {
  // Basic rate limiting (can be enhanced with Redis)
  const userIP = req.ip;
  const now = Date.now();
  
  // Simple in-memory rate limiting (replace with Redis in production)
  const globalAny = global as any;
  if (!globalAny.avatarRequests) {
    globalAny.avatarRequests = new Map();
  }
  
  const userRequests = globalAny.avatarRequests.get(userIP) || [];
  const recentRequests = userRequests.filter((time: number) => now - time < 60000); // 1 minute window
  
  if (recentRequests.length >= 30) { // Max 30 requests per minute
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.'
    });
  }
  
  recentRequests.push(now);
  globalAny.avatarRequests.set(userIP, recentRequests);
  
  next();
};

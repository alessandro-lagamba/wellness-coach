/**
 * Avatar API Client - Secure Token-Based Avatar Services
 * All avatar services use secure backend proxy
 */

import { z } from 'zod';

// ========================================
// AVATAR CLIENT INTERFACE
// ========================================

export interface AvatarClient {
  getToken(service: 'simli' | 'a2e'): Promise<AvatarToken>;
  speak(text: string, options?: SpeakOptions): Promise<SpeakResult>;
  generateAvatar(config: AvatarGenerationConfig): Promise<AvatarGenerationResult>;
  getStatus(): Promise<AvatarServicesStatus>;
}

// ========================================
// TYPES
// ========================================

// Zod schemas for API responses
const AvatarTokenSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  avatarId: z.string().optional(),
  wsUrl: z.string().optional(),
  baseUrl: z.string().optional(),
});

const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export interface SpeakOptions {
  voice?: string;
  language?: string;
  emotionContext?: {
    dominantEmotion: string;
    intensity: number;
  };
}

export interface SpeakResult {
  success: boolean;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

export interface AvatarGenerationConfig {
  type: 'rpm';
  gender?: 'male' | 'female';
  style?: 'realistic' | 'stylized';
  customizations?: Record<string, any>;
}

export interface AvatarGenerationResult {
  success: boolean;
  avatarUrl?: string;
  modelUrl?: string;
  id?: string;
  error?: string;
}

import { AvatarToken, AvatarServicesStatus } from '../types';

export type { AvatarToken, AvatarServicesStatus };

// ========================================
// SECURE AVATAR CLIENT
// ========================================

export class SecureAvatarClient implements AvatarClient {
  constructor(
    private baseUrl: string = 'http://localhost:3001'
  ) {}

  async getToken(service: 'simli' | 'a2e'): Promise<AvatarToken> {
    try {
      console.log(`[Avatar Client] 🔑 Getting ${service} token...`);

      const response = await fetch(`${this.baseUrl}/api/avatar/${service}/token`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get ${service} token: ${response.status}`);
      }

      const rawData = await response.json();
      const data = ApiResponseSchema.parse(rawData);
      
      if (!data.success) {
        throw new Error(data.error || `Failed to get ${service} token`);
      }

      console.log(`[Avatar Client] ✅ ${service} token obtained`);
      const parsedData = AvatarTokenSchema.parse(data.data);
      return {
        ...parsedData,
        provider: service,
        expiresAt: new Date(parsedData.expiresAt)
      };

    } catch (error) {
      console.error(`[Avatar Client] ❌ ${service} token error:`, error);
      throw error;
    }
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<SpeakResult> {
    try {
      console.log('[Avatar Client] 🗣️ Processing speech request...');

      const response = await fetch(`${this.baseUrl}/api/avatar/simli/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: options.voice,
          language: options.language || 'it',
          emotionContext: options.emotionContext
        })
      });

      if (!response.ok) {
        throw new Error(`Speech request failed: ${response.status}`);
      }

      const rawData = await response.json();
      const data = ApiResponseSchema.parse(rawData);
      
      if (!data.success) {
        throw new Error(data.error || 'Speech request failed');
      }

      console.log('[Avatar Client] ✅ Speech processed successfully');
      return {
        success: true,
        ...data.data
      };

    } catch (error) {
      console.error('[Avatar Client] ❌ Speech error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateAvatar(config: AvatarGenerationConfig): Promise<AvatarGenerationResult> {
    try {
      console.log('[Avatar Client] 🎨 Generating avatar...');

      const response = await fetch(`${this.baseUrl}/api/avatar/rpm/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config })
      });

      if (!response.ok) {
        throw new Error(`Avatar generation failed: ${response.status}`);
      }

      const rawData = await response.json();
      const data = ApiResponseSchema.parse(rawData);
      
      if (!data.success) {
        throw new Error(data.error || 'Avatar generation failed');
      }

      console.log('[Avatar Client] ✅ Avatar generated successfully');
      return {
        success: true,
        ...data.data
      };

    } catch (error) {
      console.error('[Avatar Client] ❌ Avatar generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getStatus(): Promise<AvatarServicesStatus> {
    try {
      console.log('[Avatar Client] 📊 Checking services status...');

      const response = await fetch(`${this.baseUrl}/api/avatar/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const rawData = await response.json();
      const data = ApiResponseSchema.parse(rawData);
      
      if (!data.success) {
        throw new Error(data.error || 'Status check failed');
      }

      console.log('[Avatar Client] ✅ Status retrieved successfully');
      return data.data as AvatarServicesStatus;

    } catch (error) {
      console.error('[Avatar Client] ❌ Status check error:', error);
      throw error;
    }
  }
}

// ========================================
// AVATAR CLIENT FACTORY
// ========================================

let avatarClientInstance: AvatarClient | null = null;

export function createAvatarClient(config?: {
  baseUrl?: string;
}): AvatarClient {
  if (!avatarClientInstance) {
    avatarClientInstance = new SecureAvatarClient(config?.baseUrl);
  }
  
  return avatarClientInstance;
}

export function getAvatarClient(): AvatarClient {
  if (!avatarClientInstance) {
    return createAvatarClient();
  }
  
  return avatarClientInstance;
}

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

export async function getSimliToken(): Promise<AvatarToken> {
  const client = getAvatarClient();
  return await client.getToken('simli');
}

export async function getA2EToken(): Promise<AvatarToken> {
  const client = getAvatarClient();
  return await client.getToken('a2e');
}

export async function speakWithAvatar(
  text: string, 
  options?: SpeakOptions
): Promise<SpeakResult> {
  const client = getAvatarClient();
  return await client.speak(text, options);
}

export async function checkAvatarServices(): Promise<AvatarServicesStatus> {
  const client = getAvatarClient();
  return await client.getStatus();
}

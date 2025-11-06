import { createClient as createDeepgramClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ElevenLabsStreamingService } from './elevenlabs-streaming.service';

export interface AgentConfig {
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  deepgramApiKey: string;
  googleApiKey: string; // Changed from geminiApiKey
  elevenLabsApiKey: string;
}

export interface VoiceChatSession {
  roomName: string;
  participantId: string;
  isActive: boolean;
  startTime: Date;
  lastActivity: Date;
  transcript: string[];
  responses: string[];
}

export class LiveKitAgentService {
  private config: AgentConfig;
  private deepgramClient: any;
  private geminiClient: GoogleGenerativeAI;
  private elevenLabsService: ElevenLabsStreamingService;
  private sessions: Map<string, VoiceChatSession> = new Map();
  private isProcessing = false;

  constructor(config: AgentConfig) {
    this.config = config;
    this.deepgramClient = createDeepgramClient(config.deepgramApiKey);
    this.geminiClient = new GoogleGenerativeAI(config.googleApiKey); // Use Google API key for Gemini
    this.elevenLabsService = new ElevenLabsStreamingService();
  }

  /**
   * Start voice chat session (server-side placeholder).
   * We do NOT join the room from Node here to avoid WebRTC/browser APIs.
   */
  async startVoiceChat(roomName: string, participantId: string): Promise<boolean> {
    try {
      console.log(`[LiveKit Agent] 🎤 Starting voice chat (session only) for ${participantId} in room ${roomName}`);

      // Create session record only; media handled by client-side for now
      const session: VoiceChatSession = {
        roomName,
        participantId,
        isActive: true,
        startTime: new Date(),
        lastActivity: new Date(),
        transcript: [],
        responses: []
      };
      this.sessions.set(participantId, session);

      return true;

    } catch (error) {
      console.error(`[LiveKit Agent] ❌ Failed to start voice chat:`, error);
      return false;
    }
  }

  /**
   * Stop voice chat session
   */
  async stopVoiceChat(participantId: string): Promise<void> {
    try {
      const session = this.sessions.get(participantId);
      if (!session) return;

      console.log(`[LiveKit Agent] 🛑 Stopping voice chat for ${participantId}`);

      // Mark session as inactive
      session.isActive = false;
      this.sessions.delete(participantId);

      console.log(`[LiveKit Agent] ✅ Voice chat stopped for ${participantId}`);

    } catch (error) {
      console.error(`[LiveKit Agent] ❌ Error stopping voice chat:`, error);
    }
  }

  /**
   * Generate LiveKit access token
   */
  private generateToken(roomName: string, identity: string): string {
    // Lazy import to avoid compile-time dependency issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AccessToken } = require('livekit-server-sdk');
    const token = new AccessToken(this.config.livekitApiKey, this.config.livekitApiSecret, {
      identity: identity,
      ttl: '1h',
    });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return token.toJwt();
  }

  /**
   * Handle incoming audio from remote participant
   */
  // Placeholder: remote audio handling is not implemented server-side in this build
  // Live media pipeline will be implemented using LiveKit Agents or server-side RTP in a follow-up

  /**
   * Transcribe audio using Deepgram
   */
  private async transcribeAudioPlaceholder(): Promise<string> { return ''; }

  /**
   * Generate AI response using Gemini
   */
  private async generateAIResponse(transcript: string, participantId: string): Promise<string> {
    try {
      console.log(`[LiveKit Agent] 🤖 Generating AI response...`);

      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const prompt = `Sei WellnessCoach, un AI coach per il benessere. Rispondi in modo breve, naturale e conversazionale in italiano. 
      
      Utente dice: "${transcript}"
      
      Risposta (max 50 parole):`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      console.log(`[LiveKit Agent] ✅ AI response generated: "${response}"`);
      
      return response;

    } catch (error) {
      console.error(`[LiveKit Agent] ❌ AI response generation failed:`, error);
      return '';
    }
  }

  /**
   * Convert AI response to speech using ElevenLabs
   */
  private async speakResponsePlaceholder(_response: string): Promise<void> { return; }

  /**
   * Convert Float32Array chunks to WAV format
   */
  // WAV helpers removed in this placeholder build

  /**
   * Read audio stream to buffer
   */
  // Stream reading helper removed in this placeholder build

  /**
   * Get session status
   */
  getSessionStatus(participantId: string): VoiceChatSession | null {
    return this.sessions.get(participantId) || null;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): VoiceChatSession[] {
    return Array.from(this.sessions.values());
  }
}

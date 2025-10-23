/**
 * TTS Controller - Text-to-Speech
 */

import { Request, Response } from 'express';
import { synthesizeSpeech } from '../services/tts.service';

export const synthesizeTTS = async (req: Request, res: Response) => {
  try {
    const { text, voice, lang = 'it' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    console.log('[TTS] 🎤 Synthesizing:', { text: text.substring(0, 50), voice, lang });

    // Use ElevenLabs TTS service
    const ttsResult = await synthesizeSpeech(text, {
      voice,
      language: lang,
      provider: 'elevenlabs'
    });

    res.json({
      success: true,
      audioUrl: ttsResult.audioUrl,
      audioBase64: ttsResult.audioBase64,
      duration: ttsResult.duration,
      visemes: ttsResult.visemes,
      meta: {
        provider: ttsResult.provider,
        voice: voice || 'default',
        language: lang
      }
    });

  } catch (error) {
    console.error('[TTS] ❌ Error:', error);
    res.status(500).json({
      success: false,
      error: 'TTS synthesis failed'
    });
  }
};

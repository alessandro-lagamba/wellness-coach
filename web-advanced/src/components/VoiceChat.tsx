/**
 * Voice Chat Component for WellnessCoach
 * Simplified version without dynamic imports
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Volume2 } from 'lucide-react';
import { useVoiceChat } from '@wellness-coach/shared/src/voice/useVoiceChat';
import { VoiceVisualizer } from './VoiceVisualizer';
import { ChatInput } from './ChatInput';

// Simple className utility function
const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');

interface VoiceChatProps {
  onMessage: (message: string) => void;
  onStartVoiceChat?: () => void;
  onStopVoiceChat?: () => void;
  isAssistantSpeaking?: boolean;
  className?: string;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({
  onMessage,
  onStartVoiceChat,
  onStopVoiceChat,
  isAssistantSpeaking = false,
  className
}) => {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Initialize voice chat hook - now guaranteed to be client-side
  const voiceChat = useVoiceChat({
    onMessage,
    onStart: () => {
      onStartVoiceChat?.();
      setRecordingDuration(0);
    },
    onStop: () => {
      onStopVoiceChat?.();
      setRecordingDuration(0);
    },
    silenceTimeoutMs: 2000,
    minRecordingDurationMs: 500,
    language: 'it-IT',
    isAssistantSpeaking // Pass assistant speaking state for pause/resume
  });

  // Timer for recording duration
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (voiceChat.isRecording) {
    interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [voiceChat.isRecording]);

  // Handle assistant speaking state
  useEffect(() => {
    if (isAssistantSpeaking && voiceChat.isRecording) {
      console.log('[VoiceChat] Pausing voice recording - assistant is speaking');
      voiceChat.stop();
    } else if (!isAssistantSpeaking && isVoiceMode && !voiceChat.isRecording && voiceChat.isSupported) {
      console.log('[VoiceChat] Resuming voice recording - assistant stopped speaking');
      // Auto-resume after a brief delay
      setTimeout(() => {
        if (isVoiceMode && !isAssistantSpeaking && voiceChat.isSupported) {
          voiceChat.start();
        }
      }, 1000);
    }
  }, [isAssistantSpeaking, isVoiceMode, voiceChat]);

  // Handle voice mode change from ChatInput
  const handleVoiceModeChange = useCallback((newVoiceMode: boolean) => {
    setIsVoiceMode(newVoiceMode);
    
    if (newVoiceMode) {
      if (voiceChat.isSupported) {
        voiceChat.start();
      } else {
        console.warn('[VoiceChat] Voice not supported on this platform');
        setIsVoiceMode(false);
      }
    } else {
      voiceChat.stop();
    }
  }, [voiceChat]);

  // Handle manual voice toggle
  const handleVoiceToggle = () => {
    if (isAssistantSpeaking) return;
    
    if (voiceChat.isRecording) {
      voiceChat.stop();
      setIsVoiceMode(false);
    } else {
      if (voiceChat.isSupported) {
        voiceChat.start();
        setIsVoiceMode(true);
      } else {
        console.warn('[VoiceChat] Voice not supported on this platform');
      }
    }
  };

  // Format recording duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Voice Controls */}
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={handleVoiceToggle}
            disabled={isAssistantSpeaking}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              isAssistantSpeaking
                ? "bg-gray-600 cursor-not-allowed text-gray-400"
                : voiceChat.isRecording
                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            )}
          >
            {isAssistantSpeaking ? (
              <Volume2 className="h-4 w-4" />
            ) : voiceChat.isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {isAssistantSpeaking
              ? "Assistant Speaking"
              : voiceChat.isRecording
              ? `Stop Recording (${formatDuration(recordingDuration)})`
              : "Start Voice Chat"}
          </button>

          {voiceChat.isRecording && (
            <button
              onClick={() => {
                voiceChat.stop();
                setIsVoiceMode(false);
              }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-colors bg-gray-600 hover:bg-gray-700 text-white"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>

        {/* Voice Status */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className={cn(
            "w-2 h-2 rounded-full",
            voiceChat.isRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"
          )} />
          <span>
            {voiceChat.isRecording ? "Recording" : "Ready"}
          </span>
        </div>
      </div>

      {/* Voice Visualizer */}
      {voiceChat.isRecording && (
        <div className="mt-4">
          <VoiceVisualizer 
            level={0.5}
            isRecording={voiceChat.isRecording}
            mode="input"
          />
        </div>
      )}

      {/* Chat Input */}
      <div className="mt-4">
        <ChatInput
          onSubmit={onMessage}
          onVoiceModeChange={handleVoiceModeChange}
          isAssistantSpeaking={isAssistantSpeaking}
          placeholder="Type your message or use voice..."
        />
      </div>

      {/* Platform Info */}
      <div className="mt-2 text-center">
        <span className="text-xs text-gray-500">
          Platform: {voiceChat.platform} | 
          Support: {voiceChat.isSupported ? 'Yes' : 'No'}
        </span>
      </div>
    </div>
  );
};

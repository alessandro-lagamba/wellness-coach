/**
 * Voice Chat Inner Component - Client-only implementation
 * Contains all the voice chat logic without SSR issues
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Volume2 } from 'lucide-react';
import { useVoiceChat } from '@wellness-coach/shared/src/voice/useVoiceChat';
import { VoiceVisualizer } from './VoiceVisualizer';
import { ChatInput } from './ChatInput';

// Simple className utility function
const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');

interface VoiceChatInnerProps {
  onMessage: (message: string) => void;
  onStartVoiceChat?: () => void;
  onStopVoiceChat?: () => void;
  isAssistantSpeaking?: boolean;
  className?: string;
}

const VoiceChatInner: React.FC<VoiceChatInnerProps> = ({
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
    let interval: NodeJS.Timeout;
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
      console.log('[VoiceChatInner] Pausing voice recording - assistant is speaking');
      voiceChat.stop();
    } else if (!isAssistantSpeaking && isVoiceMode && !voiceChat.isRecording && voiceChat.isSupported) {
      console.log('[VoiceChatInner] Resuming voice recording - assistant stopped speaking');
      // Auto-resume after a brief delay
      setTimeout(() => {
        if (isVoiceMode && !isAssistantSpeaking && voiceChat.isSupported) {
          voiceChat.start();
        }
      }, 1000);
    }
  }, [isAssistantSpeaking, isVoiceMode, voiceChat]);

  // Handle voice mode change from ChatInput
  const handleVoiceModeChange = useCallback(async (newVoiceMode: boolean) => {
    setIsVoiceMode(newVoiceMode);
    
    if (newVoiceMode && !isAssistantSpeaking && voiceChat.isSupported) {
      await voiceChat.start();
    } else if (!newVoiceMode) {
      voiceChat.stop();
    }
  }, [voiceChat, isAssistantSpeaking]);

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle manual voice toggle (for full voice mode UI)
  const handleStartVoiceMode = useCallback(async () => {
    if (!voiceChat.isSupported) {
      alert('Voice recognition not supported in this browser');
      return;
    }
    
    setIsVoiceMode(true);
    if (!isAssistantSpeaking) {
      await voiceChat.start();
    }
  }, [voiceChat, isAssistantSpeaking]);

  const handleStopVoiceMode = useCallback(() => {
    setIsVoiceMode(false);
    voiceChat.stop();
  }, [voiceChat]);

  // If not in voice mode, show the normal chat input with voice toggle
  if (!isVoiceMode) {
    return (
      <div className={cn("w-full", className)}>
        <ChatInput
          onSubmit={onMessage}
          onVoiceModeChange={handleVoiceModeChange}
          isAssistantSpeaking={isAssistantSpeaking}
          placeholder="Type your message or use voice..."
        />
        
        {/* Voice mode activation button (alternative) */}
        {voiceChat.isSupported && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleStartVoiceMode}
              disabled={isAssistantSpeaking}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200",
                "bg-blue-500 hover:bg-blue-600 text-white shadow-lg",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Mic className="w-4 h-4" />
              Start Full Voice Mode
            </button>
          </div>
        )}

        {/* Error display */}
        {voiceChat.error && (
          <div className="mt-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{voiceChat.error}</p>
          </div>
        )}
      </div>
    );
  }

  // Full voice mode UI
  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative max-w-xl w-full mx-auto">
        {/* Header with controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={voiceChat.isRecording ? voiceChat.stop : voiceChat.start}
              disabled={isAssistantSpeaking}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                voiceChat.isRecording 
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
                  : "bg-blue-500 hover:bg-blue-600 text-white",
                isAssistantSpeaking && "opacity-50 cursor-not-allowed"
              )}
            >
              {voiceChat.isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            <div className="flex flex-col">
              <span className="font-mono text-lg font-bold text-white">
                {formatTime(recordingDuration)}
              </span>
              <span className="text-xs text-gray-400">
                {isAssistantSpeaking ? "Paused - Assistant speaking" : 
                 voiceChat.isRecording ? "Listening..." : "Ready"}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleStopVoiceMode}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors"
            title="Exit voice mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Voice Visualizer */}
        <div className="mb-4">
          <VoiceVisualizer
            level={voiceChat.level}
            isRecording={voiceChat.isRecording || isAssistantSpeaking}
            mode={isAssistantSpeaking ? 'output' : 'input'}
            className="h-16"
          />
        </div>

        {/* Transcript Display */}
        <div className="w-full min-h-[60px] p-4 bg-gray-800/50 border border-gray-600/50 rounded-lg">
          <p className="text-sm text-white leading-relaxed">
            {isAssistantSpeaking ? "🔊 Assistant is responding..." :
             voiceChat.transcript ? voiceChat.transcript :
             voiceChat.isRecording ? "🎤 Listening... speak naturally" : 
             "Click the microphone to start speaking"}
          </p>
        </div>

        {/* Status Indicators */}
        <div className="mt-3 flex items-center justify-center gap-4">
          {/* Recording Status */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              voiceChat.isRecording && !isAssistantSpeaking ? "bg-green-500 animate-pulse" : "bg-gray-600"
            )} />
            <span className="text-xs text-gray-400">
              {voiceChat.isRecording && !isAssistantSpeaking ? "Recording" : "Idle"}
            </span>
          </div>

          {/* Assistant Status */}
          {isAssistantSpeaking && (
            <div className="flex items-center gap-2">
              <Volume2 className="w-3 h-3 text-green-400 animate-pulse" />
              <span className="text-xs text-green-400">Assistant Speaking</span>
            </div>
          )}

          {/* Audio Level */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Level: {Math.round(voiceChat.level * 100)}%
            </span>
          </div>
        </div>

        {/* Error Display */}
        {voiceChat.error && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{voiceChat.error}</p>
          </div>
        )}

        {/* Platform Info */}
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-500">
            Platform: {voiceChat.platform} | 
            Support: {voiceChat.isSupported ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VoiceChatInner;

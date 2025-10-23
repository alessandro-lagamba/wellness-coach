/**
 * Avatar Panel - Center Column
 * Avatar placeholder with modular structure for future 3D/Simli integration
 */

'use client';

import { useState, useEffect } from 'react';

interface AvatarPanelProps {
  isConnected: boolean;
  currentEmotion: any;
}

export function AvatarPanel({ isConnected, currentEmotion }: AvatarPanelProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [avatarMood, setAvatarMood] = useState('neutral');

  // Update avatar mood based on emotion
  useEffect(() => {
    if (currentEmotion?.dominantEmotion) {
      setAvatarMood(currentEmotion.dominantEmotion);
    }
  }, [currentEmotion]);

  const getAvatarEmoji = () => {
    if (!isConnected) return '😴';
    if (isSpeaking) return '🗣️';
    
    switch (avatarMood) {
      case 'happiness': return '😊';
      case 'sadness': return '😢';
      case 'anger': return '😠';
      case 'fear': return '😨';
      case 'surprise': return '😲';
      case 'disgust': return '🤢';
      default: return '🤖';
    }
  };

  const getAvatarColor = () => {
    if (!isConnected) return 'bg-gray-600';
    if (isSpeaking) return 'bg-green-500';
    
    switch (avatarMood) {
      case 'happiness': return 'bg-green-500';
      case 'sadness': return 'bg-blue-500';
      case 'anger': return 'bg-red-500';
      case 'fear': return 'bg-purple-500';
      case 'surprise': return 'bg-yellow-500';
      case 'disgust': return 'bg-pink-500';
      default: return 'bg-indigo-500';
    }
  };

  const simulateSpeak = async () => {
    if (!isConnected || isSpeaking) return;
    
    setIsSpeaking(true);
    
    try {
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Ciao! Sono il tuo wellness coach. Come ti senti oggi?',
          language: 'it'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('TTS Response:', data);
        
        // Play the actual audio
        if (data.audioBase64) {
          // Convert base64 to blob URL for audio playback
          const audioBlob = new Blob([
            Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0))
          ], { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          const audio = new Audio(audioUrl);
          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl); // Clean up blob URL
          };
          audio.onerror = (e) => {
            console.error('Audio playback failed:', e);
            URL.revokeObjectURL(audioUrl); // Clean up blob URL
            setTimeout(() => setIsSpeaking(false), 1000);
          };
          await audio.play();
        } else if (data.audioUrl) {
          // Direct URL playback (fallback)
          const audio = new Audio(data.audioUrl);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => {
            console.error('Audio playback failed');
            setTimeout(() => setIsSpeaking(false), 1000);
          };
          await audio.play();
        } else {
          // Fallback to duration-based timing
          setTimeout(() => setIsSpeaking(false), data.duration * 1000 || 3000);
        }
      } else {
        throw new Error('TTS failed');
      }
    } catch (error) {
      console.error('TTS error:', error);
      setTimeout(() => setIsSpeaking(false), 1000);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-800/50">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-xl font-semibold text-white mb-2">
          🤖 Wellness Coach
        </h2>
        <div className="text-sm text-gray-400">
          Status: {isConnected ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Avatar Display */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Avatar Circle */}
        <div className={`
          relative w-64 h-64 rounded-full flex items-center justify-center
          ${getAvatarColor()} transition-all duration-500
          ${isSpeaking ? 'animate-pulse scale-110' : 'scale-100'}
          shadow-2xl
        `}>
          {/* Avatar Emoji */}
          <div className="text-8xl">
            {getAvatarEmoji()}
          </div>
          
          {/* Speaking Animation */}
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />
          )}
          
          {/* Connection Ring */}
          {isConnected && (
            <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-pulse" />
          )}
        </div>

        {/* Avatar Info */}
        <div className="mt-6 text-center">
          <div className="text-xl font-semibold text-white mb-2">
            WellnessCoach AI
          </div>
          <div className="text-sm text-gray-400 mb-4">
            Current Mood: <span className="capitalize text-white">{avatarMood}</span>
          </div>
          
          {/* Emotion Indicators */}
          {currentEmotion && (
            <div className="bg-black/30 rounded-lg p-4 max-w-sm">
              <div className="text-xs text-gray-400 mb-2">Detected Emotion</div>
              <div className="flex items-center justify-between text-sm">
                <span>Valence:</span>
                <span className={`font-mono ${currentEmotion.valence > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {currentEmotion.valence?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Arousal:</span>
                <span className={`font-mono ${currentEmotion.arousal > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                  {currentEmotion.arousal?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Avatar Controls */}
        <div className="mt-6 flex space-x-4">
          <button
            onClick={simulateSpeak}
            disabled={!isConnected || isSpeaking}
            className={`
              px-6 py-2 rounded-lg font-medium transition-colors
              ${isConnected && !isSpeaking
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {isSpeaking ? 'Speaking...' : 'Test Speak'}
          </button>
        </div>
      </div>

      {/* Technical Info */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="text-xs text-gray-500 space-y-1">
          <div>Avatar Type: Placeholder (Modular)</div>
          <div>Future: 3D Avatar / Simli Integration</div>
          <div>Framework: Ready for any avatar system</div>
        </div>
      </div>
    </div>
  );
}

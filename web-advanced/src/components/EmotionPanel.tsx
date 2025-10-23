/**
 * Emotion Detection Panel - Left Column
 * Real-time emotion analysis with charts and metrics
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { EmotionDetectionService, EmotionResult } from '@/services/emotionDetection';
import { Sparkles } from 'lucide-react';

interface EmotionPanelProps {
  currentEmotion: any;
  onEmotionChange: (emotion: any) => void;
  onVideoElementChange?: (video: HTMLVideoElement | null) => void;
  onLandmarksChange?: (landmarks: number[][] | null) => void;
  onAnalyzingChange?: (active: boolean) => void;
  onRequestSkinSection?: () => void;
}

export function EmotionPanel({ 
  currentEmotion, 
  onEmotionChange,
  onVideoElementChange,
  onLandmarksChange,
  onAnalyzingChange,
  onRequestSkinSection
}: EmotionPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [emotions, setEmotions] = useState({
    happiness: 0,
    sadness: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
    disgust: 0,
    neutral: 0.8
  });
  const [valence, setValence] = useState(0);
  const [arousal, setArousal] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
const landmarksRef = useRef<number[][] | null>(null);
  const emotionServiceRef = useRef<EmotionDetectionService | null>(null);

  // Initialize emotion detection service
  useEffect(() => {
    emotionServiceRef.current = new EmotionDetectionService();
    
    return () => {
      if (emotionServiceRef.current) {
        emotionServiceRef.current.stopDetection();
      }
    };
  }, []);

  // Handle emotion detection results
  const handleEmotionResult = (result: EmotionResult) => {
    setEmotions(result.emotions);
    setValence(result.valence);
    setArousal(result.arousal);
    setConfidence(result.confidence);
    
    onEmotionChange({
      emotions: result.emotions,
      valence: result.valence,
      arousal: result.arousal,
      dominantEmotion: result.dominantEmotion,
      confidence: result.confidence
    });
  };


  const startAnalysis = async () => {
    if (!emotionServiceRef.current || !videoRef.current) {
      console.error('Emotion service or video element not available');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      videoRef.current.srcObject = stream;
      onVideoElementChange?.(videoRef.current);
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = resolve;
        }
      });

      // Start MediaPipe emotion detection with landmarks callback
      const success = await emotionServiceRef.current.startDetection(
        videoRef.current,
        handleEmotionResult,
        (landmarks) => {
          if (!landmarks) {
            landmarksRef.current = null;
            onLandmarksChange?.(null);
            return;
          }

          // Always emit a fresh copy so downstream React state updates
          const sanitized = Array.from(landmarks, (point: any) => {
            if (Array.isArray(point)) {
              return [point[0], point[1]];
            }
            if (point && typeof point === 'object') {
              return [point.x, point.y];
            }
            return [0, 0];
          });

          landmarksRef.current = sanitized;
          onLandmarksChange?.(sanitized);
        }
      );

      if (success) {
        setIsAnalyzing(true);
        onAnalyzingChange?.(true);
        console.log('[EmotionPanel] ✅ Real emotion detection started');
      } else {
        throw new Error('Failed to start emotion detection');
      }
    } catch (error) {
      console.error('[EmotionPanel] ❌ Camera/detection error:', error);
      alert('Camera access denied or MediaPipe failed to initialize');
      onAnalyzingChange?.(false);
      onVideoElementChange?.(null);
      onLandmarksChange?.(null);
      landmarksRef.current = null;
    }
  };

  const stopAnalysis = () => {
    if (emotionServiceRef.current) {
      emotionServiceRef.current.stopDetection();
    }
    
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsAnalyzing(false);
    onAnalyzingChange?.(false);
    onVideoElementChange?.(null);
    onLandmarksChange?.(null);
    landmarksRef.current = null;
    console.log('[EmotionPanel] 🛑 Emotion detection stopped');
  };

  return (
    <div className="flex h-full flex-col bg-slate-900/50 border border-white/10 rounded-xl shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-xl font-semibold text-white mb-2">
          🎭 Emotion Detection
        </h2>
        <div className="flex gap-2">
          <button
            onClick={isAnalyzing ? stopAnalysis : startAnalysis}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${isAnalyzing 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }
            `}
          >
            {isAnalyzing ? 'Stop Analysis' : 'Start Analysis'}
          </button>
          <button
            onClick={() => {
              console.log('[EmotionPanel] Skin Analysis button clicked');
              onRequestSkinSection?.();
            }}
            className="px-4 py-2 rounded-lg font-medium transition-colors bg-purple-500 hover:bg-purple-600 text-white flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Skin Analysis
          </button>
        </div>
      </div>

      {/* Camera Preview */}
      <div className="p-4">
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-4xl mb-2">📷</div>
                <div>Click "Start Analysis" to begin</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emotion Metrics */}
      <div className="flex-1 p-4 space-y-4">
        {/* Valence, Arousal & Confidence */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-1">Valence</div>
            <div className="text-lg font-bold text-white">
              {valence.toFixed(2)}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((valence + 1) / 2) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-1">Arousal</div>
            <div className="text-lg font-bold text-white">
              {arousal.toFixed(2)}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((arousal + 1) / 2) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-1">Confidence</div>
            <div className="text-lg font-bold text-white">
              {(confidence * 100).toFixed(0)}%
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Individual Emotions */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-300">Emotion Breakdown</h3>
          {isAnalyzing && (
            <div className="text-xs text-blue-400 mb-2">
              {emotions && 'source' in emotions ? (
                emotions.source === 'mediapipe-blendshapes' 
                  ? '🧠 MediaPipe (blendshapes)' 
                  : '✨ Simplified analysis'
              ) : '🔄 Initializing...'}
            </div>
          )}
          {Object.entries(emotions).map(([emotion, value]) => (
            <div key={emotion} className="flex items-center justify-between">
              <span className="text-sm text-gray-400 capitalize">{emotion}</span>
              <div className="flex items-center space-x-2">
                <div className="w-20 bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      emotion === 'happiness' ? 'bg-green-500' :
                      emotion === 'sadness' ? 'bg-blue-500' :
                      emotion === 'anger' ? 'bg-red-500' :
                      emotion === 'fear' ? 'bg-purple-500' :
                      emotion === 'surprise' ? 'bg-yellow-500' :
                      emotion === 'disgust' ? 'bg-pink-500' :
                      'bg-gray-500'
                    }`}
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">
                  {(value * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

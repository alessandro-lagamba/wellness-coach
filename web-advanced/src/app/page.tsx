/**
 * WellnessCoach Web Advanced - Main Dashboard
 * Neurotracer-style 3-column layout: Emotions | Camera/Avatar | Suggestions/Chat
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AvatarPanel } from '@/components/AvatarPanel';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { AnalysisTabs } from '@/components/AnalysisTabs';
import { WellnessSuggestions } from '@/components/WellnessSuggestions';
import { FloatingChat } from '@/components/FloatingChat';

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  const [skinVideoEl, setSkinVideoEl] = useState<HTMLVideoElement | null>(null);
  const [skinLandmarks, setSkinLandmarks] = useState<number[][] | null>(null);
  const [isEmotionAnalyzing, setIsEmotionAnalyzing] = useState(false);
  const [skinMetrics, setSkinMetrics] = useState(null);
  const [emotionData, setEmotionData] = useState(null);
  
  // Handle video element changes from emotion detection
  const handleVideoElementChange = useCallback((video: HTMLVideoElement | null) => {
    console.log('[Dashboard] Video element changed:', {
      hasVideo: !!video,
      videoReady: video?.readyState >= 2,
      videoDimensions: video ? `${video.videoWidth}x${video.videoHeight}` : 'N/A'
    });
    setSkinVideoEl(video);
  }, []);

  // Handle landmarks changes from emotion detection
  const handleLandmarksChange = useCallback((landmarks: number[][] | null) => {
    console.log('[Dashboard] Landmarks changed:', {
      hasLandmarks: !!landmarks,
      landmarksCount: landmarks?.length || 0
    });
    setSkinLandmarks(landmarks);
  }, []);

  // Handle analyzing state changes
  const handleAnalyzingChange = useCallback((analyzing: boolean) => {
    console.log('[Dashboard] Analyzing state changed:', analyzing);
    setIsEmotionAnalyzing(analyzing);
  }, []);

  // Handle skin metrics changes
  const handleSkinMetricsChange = useCallback((metrics: any) => {
    console.log('[Dashboard] Skin metrics changed:', metrics);
    setSkinMetrics(metrics);
  }, []);

  // Handle emotion data changes
  const handleEmotionDataChange = useCallback((data: any) => {
    console.log('[Dashboard] Emotion data changed:', data);
    setEmotionData(data);
  }, []);

  // Test backend connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await fetch('/api/health');
        if (!response.ok) {
          const body = await response.text();
          console.warn(`Health check failed: ${response.status} ${body.slice(0, 120)}`);
          setIsConnected(false);
          return;
        }

        const data = await response.json();
        setIsConnected(Boolean(data.success));
      } catch (error) {
        console.error('Backend connection failed:', error);
        setIsConnected(false);
      }
    };

    testConnection();
    const interval = setInterval(testConnection, 30000); // Check every 30s
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 fixed inset-0 overflow-hidden">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 relative z-10">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="text-2xl font-bold text-white">
              🧠 WellnessCoach
            </div>
            <div className="text-sm text-gray-400">
              Advanced Wellness Dashboard
            </div>
          </div>
          <ConnectionStatus isConnected={isConnected} />
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] gap-4 lg:gap-0 relative z-0 overflow-y-auto">
        {/* Left Column: Analysis Tabs (Emotion Detection & Skin Analysis) */}
        <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-white/10 min-w-0">
          <div className="h-full p-4">
            <AnalysisTabs
              currentEmotion={currentEmotion}
              onEmotionChange={setCurrentEmotion}
              onVideoElementChange={handleVideoElementChange}
              onLandmarksChange={handleLandmarksChange}
              onAnalyzingChange={handleAnalyzingChange}
              onSkinMetricsChange={handleSkinMetricsChange}
              onEmotionDataChange={handleEmotionDataChange}
              skinVideoEl={skinVideoEl}
              skinLandmarks={skinLandmarks}
              isEmotionAnalyzing={isEmotionAnalyzing}
            />
          </div>
        </div>

        {/* Center Column: Camera/Avatar */}
        <div className="w-full lg:w-1/3 lg:border-r border-white/10 min-w-0">
          <div className="h-full flex flex-col p-4 lg:p-6 gap-4">
            <AvatarPanel 
              isConnected={Boolean(isConnected)}
              currentEmotion={currentEmotion}
            />
          </div>
        </div>

        {/* Right Column: Wellness Suggestions */}
        <div className="w-full lg:w-1/3 min-w-0">
          <div className="h-full p-4 lg:p-6">
            <WellnessSuggestions
              skinMetrics={skinMetrics}
              emotionData={emotionData}
              isAnalyzing={isEmotionAnalyzing}
            />
          </div>
        </div>
      </div>

      {/* Floating Chat */}
      <FloatingChat
        isConnected={Boolean(isConnected)}
        currentEmotion={currentEmotion}
        onSendMessage={(message) => {
          console.log('Chat message:', message);
          // Handle chat message here
        }}
      />
    </div>
  );
}

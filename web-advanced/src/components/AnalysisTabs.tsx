/**
 * Analysis Tabs - Tabbed interface for Emotion Detection and Skin Analysis
 * Provides better organization and prevents UI overlapping
 */

"use client";

import React, { useState } from 'react';
import { EmotionPanel } from './EmotionPanel';
import { SkinPanel } from './SkinPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Sparkles, 
  Activity,
  Camera,
  BarChart3
} from 'lucide-react';

interface AnalysisTabsProps {
  currentEmotion: any;
  onEmotionChange: (emotion: any) => void;
  onVideoElementChange: (videoEl: HTMLVideoElement | null) => void;
  onLandmarksChange: (landmarks: number[][] | null) => void;
  onAnalyzingChange: (analyzing: boolean) => void;
  onSkinMetricsChange: (metrics: any) => void;
  onEmotionDataChange: (data: any) => void;
  skinVideoEl: HTMLVideoElement | null;
  skinLandmarks: number[][] | null;
  isEmotionAnalyzing: boolean;
}

type TabType = 'emotion' | 'skin';

export function AnalysisTabs({
  currentEmotion,
  onEmotionChange,
  onVideoElementChange,
  onLandmarksChange,
  onAnalyzingChange,
  onSkinMetricsChange,
  onEmotionDataChange,
  skinVideoEl,
  skinLandmarks,
  isEmotionAnalyzing
}: AnalysisTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('emotion');

  const tabs = [
    {
      id: 'emotion' as TabType,
      label: 'Emotion Detection',
      icon: Brain,
      description: 'Real-time emotion analysis',
      badge: isEmotionAnalyzing ? 'Active' : 'Ready'
    },
    {
      id: 'skin' as TabType,
      label: 'Skin Analysis',
      icon: Sparkles,
      description: 'Skin health metrics',
      badge: 'Beta'
    }
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900/50 border border-white/10 rounded-xl shadow-lg">
      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 bg-slate-800/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                ${isActive 
                  ? 'bg-blue-500/20 text-blue-300 border-b-2 border-blue-400' 
                  : 'text-gray-400 hover:text-gray-300 hover:bg-slate-700/50'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <Badge 
                variant={tab.badge === 'Active' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {tab.badge}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'emotion' && (
          <div className="h-full overflow-y-auto">
            <EmotionPanel 
              currentEmotion={currentEmotion}
              onEmotionChange={onEmotionChange}
              onVideoElementChange={onVideoElementChange}
              onLandmarksChange={onLandmarksChange}
              onAnalyzingChange={onAnalyzingChange}
              onEmotionDataChange={onEmotionDataChange}
              onRequestSkinSection={() => setActiveTab('skin')}
            />
          </div>
        )}
        
        {activeTab === 'skin' && (
          <div className="h-full overflow-y-auto">
            <SkinPanel
              videoElement={skinVideoEl ?? undefined}
              landmarks={skinLandmarks ?? undefined}
              isConnected={isEmotionAnalyzing}
              onSkinMetricsChange={onSkinMetricsChange}
            />
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="border-t border-white/10 bg-slate-800/30 p-3">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Camera className="h-3 w-3" />
              <span>Camera: {isEmotionAnalyzing ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              <span>Analysis: {activeTab === 'emotion' ? 'Emotion' : 'Skin'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            <span>Status: {isEmotionAnalyzing ? 'Running' : 'Ready'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


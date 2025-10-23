/**
 * Real-time audio visualizer component
 * Shows audio levels with different colors for input/output modes
 */

import React from 'react';
// Simple className utility function
const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');

interface VoiceVisualizerProps {
  level: number; // 0-1 audio level
  isRecording: boolean;
  mode: 'input' | 'output'; // input = primary color, output = secondary color
  barCount?: number;
  className?: string;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  level,
  isRecording,
  mode,
  barCount = 32,
  className
}) => {
  // Generate bar heights based on audio level and some randomness for visual appeal
  const generateBarHeights = () => {
    if (!isRecording || level === 0) {
      // Static low bars when not recording
      return Array(barCount).fill(0).map(() => 8);
    }

    // Create a more realistic frequency spectrum visualization
    const bars = [];
    for (let i = 0; i < barCount; i++) {
      // Create frequency-like distribution (lower frequencies = higher bars)
      const freqWeight = Math.exp(-i / (barCount * 0.3));
      
      // Base height from audio level
      const baseHeight = level * 60 * freqWeight;
      
      // Add some randomness for visual appeal
      const randomVariation = (Math.random() - 0.5) * 20;
      
      // Smooth animation with sine wave
      const timeOffset = Date.now() / 100;
      const waveVariation = Math.sin((i * 0.5) + timeOffset) * 5;
      
      const finalHeight = Math.max(4, Math.min(80, baseHeight + randomVariation + waveVariation));
      bars.push(finalHeight);
    }
    
    return bars;
  };

  const barHeights = generateBarHeights();

  const getBarColor = () => {
    if (!isRecording) {
      return 'bg-gray-600';
    }
    
    return mode === 'input' 
      ? 'bg-blue-500' // Primary color for input
      : 'bg-green-500'; // Secondary color for output
  };

  const getBarGlow = () => {
    if (!isRecording || level < 0.1) {
      return '';
    }
    
    return mode === 'input'
      ? 'shadow-blue-500/50'
      : 'shadow-green-500/50';
  };

  return (
    <div className={cn(
      "flex items-end justify-center gap-0.5 h-16",
      className
    )}>
      {barHeights.map((height, index) => (
        <div
          key={index}
          className={cn(
            "rounded-full transition-all duration-100 ease-out",
            getBarColor(),
            getBarGlow(),
            isRecording && level > 0.1 && "shadow-sm"
          )}
          style={{
            height: `${height}%`,
            width: '2px',
            minHeight: '4px',
            animationDelay: `${index * 50}ms`
          }}
        />
      ))}
    </div>
  );
};

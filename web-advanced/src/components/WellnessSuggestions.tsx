/**
 * Wellness Suggestions Component
 * Inspired by mobile mockups - provides actionable wellness advice
 */

"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Heart,
  Brain,
  Droplets,
  Sun,
  Activity,
  Shield,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Target
} from 'lucide-react';

interface WellnessSuggestion {
  id: string;
  title: string;
  description: string;
  category: 'mind-body' | 'nutrition' | 'skin-care' | 'lifestyle';
  priority: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  action?: string;
  estimatedTime?: string;
}

interface WellnessSuggestionsProps {
  skinMetrics?: {
    texture: number;
    redness: number;
    shine: number;
    overall: number;
    confidence: number;
  };
  emotionData?: {
    valence: number;
    arousal: number;
  };
  isAnalyzing?: boolean;
}

export function WellnessSuggestions({
  skinMetrics,
  emotionData,
  isAnalyzing = false
}: WellnessSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<WellnessSuggestion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'mind-body' | 'nutrition' | 'skin-care' | 'lifestyle'>('all');

  const generateSuggestions = (): WellnessSuggestion[] => {
    const suggestions: WellnessSuggestion[] = [];

    // Skin-based suggestions
    if (skinMetrics) {
      if (skinMetrics.texture < 50) {
        suggestions.push({
          id: 'exfoliation',
          title: 'Gentle Exfoliation',
          description: 'Use a gentle exfoliant 2-3 times per week to improve skin texture',
          category: 'skin-care',
          priority: 'high',
          icon: <Activity className="h-5 w-5" />,
          action: 'Apply gentle exfoliant',
          estimatedTime: '5 min'
        });
      }

      if (skinMetrics.redness > 60) {
        suggestions.push({
          id: 'soothing-care',
          title: 'Soothing Skincare',
          description: 'Use calming ingredients like aloe vera or chamomile to reduce redness',
          category: 'skin-care',
          priority: 'high',
          icon: <Shield className="h-5 w-5" />,
          action: 'Apply soothing serum',
          estimatedTime: '2 min'
        });
      }

      if (skinMetrics.shine > 70) {
        suggestions.push({
          id: 'oil-control',
          title: 'Oil Control',
          description: 'Use oil-control products to manage excess shine',
          category: 'skin-care',
          priority: 'medium',
          icon: <Droplets className="h-5 w-5" />,
          action: 'Apply oil-control primer',
          estimatedTime: '3 min'
        });
      }

      if (skinMetrics.overall < 50) {
        suggestions.push({
          id: 'hydration',
          title: 'Increase Hydration',
          description: 'Drink more water and use hydrating skincare products',
          category: 'nutrition',
          priority: 'high',
          icon: <Droplets className="h-5 w-5" />,
          action: 'Drink a glass of water',
          estimatedTime: '1 min'
        });
      }
    }

    // Emotion-based suggestions
    if (emotionData) {
      if (emotionData.valence < -0.2) {
        suggestions.push({
          id: 'breathing',
          title: 'Breathing Exercises',
          description: 'Practice deep breathing to reduce stress and improve mood',
          category: 'mind-body',
          priority: 'high',
          icon: <Heart className="h-5 w-5" />,
          action: 'Start breathing exercise',
          estimatedTime: '5 min'
        });
      }

      if (emotionData.arousal > 0.3) {
        suggestions.push({
          id: 'relaxation',
          title: 'Relaxation Techniques',
          description: 'Try meditation or gentle stretching to calm your mind',
          category: 'mind-body',
          priority: 'medium',
          icon: <Brain className="h-5 w-5" />,
          action: 'Begin meditation',
          estimatedTime: '10 min'
        });
      }
    }

    // General wellness suggestions
    suggestions.push(
      {
        id: 'walk',
        title: 'Take a Walk',
        description: 'Enjoy a brisk walk outdoors to boost your mood and circulation',
        category: 'lifestyle',
        priority: 'medium',
        icon: <Activity className="h-5 w-5" />,
        action: 'Go for a walk',
        estimatedTime: '15 min'
      },
      {
        id: 'balanced-diet',
        title: 'Balanced Diet',
        description: 'Focus on a diet rich in fruits, vegetables, and antioxidants',
        category: 'nutrition',
        priority: 'medium',
        icon: <Sun className="h-5 w-5" />,
        action: 'Plan healthy meal',
        estimatedTime: '30 min'
      },
      {
        id: 'sleep',
        title: 'Quality Sleep',
        description: 'Get 7-9 hours of quality sleep for optimal skin and mental health',
        category: 'lifestyle',
        priority: 'high',
        icon: <Clock className="h-5 w-5" />,
        action: 'Set bedtime routine',
        estimatedTime: '1 min'
      }
    );

    return suggestions.slice(0, 6); // Limit to 6 suggestions
  };

  useEffect(() => {
    setSuggestions(generateSuggestions());
  }, [skinMetrics, emotionData]);

  const filteredSuggestions = selectedCategory === 'all' 
    ? suggestions 
    : suggestions.filter(s => s.category === selectedCategory);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-200 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-200 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-200 border-gray-500/30';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'mind-body': return <Brain className="h-4 w-4" />;
      case 'nutrition': return <Droplets className="h-4 w-4" />;
      case 'skin-care': return <Shield className="h-4 w-4" />;
      case 'lifestyle': return <Activity className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Wellness Suggestions</h2>
            <p className="text-sm text-gray-300">Personalized wellness coaching</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs text-white border-white/20">
          {suggestions.length} suggestions
        </Badge>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All', icon: <Target className="h-4 w-4" /> },
          { key: 'mind-body', label: 'Mind & Body', icon: <Brain className="h-4 w-4" /> },
          { key: 'nutrition', label: 'Nutrition', icon: <Droplets className="h-4 w-4" /> },
          { key: 'skin-care', label: 'Skin Care', icon: <Shield className="h-4 w-4" /> },
          { key: 'lifestyle', label: 'Lifestyle', icon: <Activity className="h-4 w-4" /> }
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key as any)}
            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${
              selectedCategory === key 
                ? 'bg-purple-500 hover:bg-purple-600 text-white border border-purple-400' 
                : 'bg-purple-500/20 border border-purple-400/30 text-purple-200 hover:bg-purple-500/30 hover:text-white hover:border-purple-400/50'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Suggestions Grid */}
      <div className="grid gap-3">
        {filteredSuggestions.length === 0 ? (
          <div className="p-6 text-center rounded-lg border border-white/10 bg-white/5">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-400">No suggestions available. Start analysis to get personalized recommendations.</p>
          </div>
        ) : (
          filteredSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-white/10">
                    {suggestion.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-white">{suggestion.title}</h3>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getPriorityColor(suggestion.priority)}`}
                      >
                        {suggestion.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-300 mb-3">{suggestion.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          {getCategoryIcon(suggestion.category)}
                          <span className="capitalize">{suggestion.category.replace('-', ' ')}</span>
                        </div>
                        {suggestion.estimatedTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{suggestion.estimatedTime}</span>
                          </div>
                        )}
                      </div>
                      {suggestion.action && (
                        <button 
                          className="px-3 py-1.5 text-xs font-medium rounded-md bg-purple-500/20 border border-purple-400/30 text-purple-200 hover:bg-purple-500/30 hover:text-white hover:border-purple-400/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        >
                          {suggestion.action}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Analysis Status */}
      {isAnalyzing && (
        <div className="rounded-lg border border-blue-400/40 bg-blue-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-blue-200">Analysis in Progress</p>
              <p className="text-xs text-blue-300">Generating personalized suggestions...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WellnessSuggestions;

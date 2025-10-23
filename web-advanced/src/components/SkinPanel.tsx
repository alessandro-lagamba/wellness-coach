/**
 * Skin Analysis Panel - Real-time skin metrics display
 * Integrates with existing emotion detection system
 */

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Play,
  Square,
  Activity,
  Droplets,
  Sun,
  TrendingUp,
  Eye,
  EyeOff,
  Info,
  Heart,
  Sparkles,
  Shield,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';
import { SkinMetrics, startSkinAnalysis, stopSkinAnalysis } from '../services/skinAnalysis';

type LandmarkInput = number[][];

interface SkinPanelProps {
  videoElement?: HTMLVideoElement;
  landmarks?: LandmarkInput;
  isConnected?: boolean;
  onSkinMetricsChange?: (metrics: SkinMetrics) => void;
}

export function SkinPanel({
  videoElement,
  landmarks,
  isConnected = false,
  onSkinMetricsChange
}: SkinPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metrics, setMetrics] = useState<SkinMetrics>({
    texture: 0,
    redness: 0,
    shine: 0,
    overall: 0,
    confidence: 0,
    source: 'fallback'
  });
  const [showOverlay, setShowOverlay] = useState(false);
  const [fps, setFps] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [showInfoBox, setShowInfoBox] = useState(false);
  const [wellnessTips, setWellnessTips] = useState<string[]>([]);

  const fpsRef = useRef<number[]>([]);
  const isAnalyzingRef = useRef(false);
  const overlayInitializedRef = useRef(false);
  const showOverlayRef = useRef(showOverlay);
  const videoElementRef = useRef<HTMLVideoElement | undefined>(videoElement);
  const landmarksRef = useRef<LandmarkInput | undefined>(landmarks);
  const canAnalyzeRef = useRef<boolean>(Boolean(videoElement && isConnected));
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const canAnalyze = Boolean(videoElement && isConnected);

  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);

  useEffect(() => {
    videoElementRef.current = videoElement;
  }, [videoElement]);

  useEffect(() => {
    landmarksRef.current = landmarks;
  }, [landmarks]);

  useEffect(() => {
    canAnalyzeRef.current = canAnalyze;
  }, [canAnalyze]);

  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  const handleStopAnalysis = useCallback(async () => {
    if (!isAnalyzingRef.current) {
      return;
    }
    stopSkinAnalysis();
    isAnalyzingRef.current = false;
    setIsAnalyzing(false);
    setFps(0);
    fpsRef.current = [];

    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const overlayCtx = canvas.getContext('2d');
      overlayCtx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const waitForOverlayCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (!showOverlayRef.current) {
      return null;
    }

    if (overlayCanvasRef.current) {
      return overlayCanvasRef.current;
    }

    const canvas = await new Promise<HTMLCanvasElement | null>(resolve => {
      let attempts = 0;
      const maxAttempts = 20;

      const check = () => {
        const current = overlayCanvasRef.current;
        if (current) {
          resolve(current);
          return;
        }
        attempts++;
        if (attempts >= maxAttempts || !showOverlayRef.current) {
          resolve(null);
          return;
        }
        requestAnimationFrame(check);
      };

      requestAnimationFrame(check);
    });

    return canvas;
  }, []);

  const handleStartAnalysis = useCallback(async (overlayEnabled?: boolean) => {
    const videoRef = videoElementRef.current;
    const landmarkRef = landmarksRef.current;
    const overlay = overlayEnabled ?? showOverlayRef.current;
    const overlayCanvasEl = overlay ? await waitForOverlayCanvas() : null;
    if (overlay && !overlayCanvasEl) {
      console.warn('[SkinPanel] Overlay requested but canvas not ready; continuing without overlay');
    }

    if (overlayCanvasEl) {
      overlayCanvasEl.setAttribute('willReadFrequently', 'true');
    }
    const landmarkProvider = () => landmarksRef.current ?? null;

    if (!videoRef || !canAnalyzeRef.current || isAnalyzingRef.current) {
      console.log('[SkinPanel] Cannot start analysis:', {
        hasVideo: !!videoRef,
        canAnalyze: canAnalyzeRef.current,
        isAnalyzing: isAnalyzingRef.current,
        videoReady: videoRef?.readyState >= 2,
        videoDimensions: videoRef ? `${videoRef.videoWidth}x${videoRef.videoHeight}` : 'N/A'
      });
      return false;
    }

    // Check if video element is still valid and has a source
    if (!videoRef.srcObject && !videoRef.src) {
      console.log('[SkinPanel] Video element has no source, trying to get camera access...');
      
      // Try to get camera access for skin analysis
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });
        
        videoRef.srcObject = stream;
        videoRef.play();
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef) {
            videoRef.onloadedmetadata = resolve;
          }
        });
        
        console.log('[SkinPanel] Camera access obtained for skin analysis');
      } catch (error) {
        console.error('[SkinPanel] Failed to get camera access:', error);
        return false;
      }
    }

    // Wait for video to be ready if it's not already (with timeout)
    if (videoRef.readyState < 2 || videoRef.videoWidth === 0 || videoRef.videoHeight === 0) {
      console.log('[SkinPanel] Waiting for video to be ready...');
      try {
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 50; // 5 seconds timeout (50 * 100ms)
          
          const checkReady = () => {
            attempts++;
            
            // Check if video element is still valid
            if (!videoRef || videoRef.readyState === 0) {
              console.log('[SkinPanel] Video element is no longer valid');
              reject(new Error('Video element is no longer valid'));
              return;
            }
            
            if (videoRef.readyState >= 2 && videoRef.videoWidth > 0 && videoRef.videoHeight > 0) {
              console.log('[SkinPanel] Video is ready!', {
                readyState: videoRef.readyState,
                dimensions: `${videoRef.videoWidth}x${videoRef.videoHeight}`
              });
              resolve(true);
            } else if (attempts >= maxAttempts) {
              console.log('[SkinPanel] Timeout waiting for video to be ready');
              reject(new Error('Timeout waiting for video to be ready'));
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      } catch (error) {
        console.error('[SkinPanel] Failed to wait for video:', error);
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        return false;
      }
    }

    try {
      fpsRef.current = [];
      setFps(0);
      isAnalyzingRef.current = true;
      setIsAnalyzing(true);

      console.log('[SkinPanel] Starting analysis with:', {
        hasVideo: !!videoRef,
        hasLandmarks: !!landmarkRef,
        landmarksCount: landmarkRef?.length || 0,
        overlayEnabled: overlay,
        hasOverlayCanvas: !!overlayCanvasEl
      });

      const success = await startSkinAnalysis(
        {
          videoEl: videoRef,
          landmarks: landmarkProvider,
          targetFps: 1, // Reduced from 2 to 1 FPS to reduce lag
          enableOverlay: overlay && !!overlayCanvasEl,
          overlayCanvas: overlayCanvasEl ?? undefined
        },
        (newMetrics) => {
          console.log('[SkinPanel] New metrics received:', newMetrics);
          // Use functional update to prevent stale closure issues
          setMetrics(prevMetrics => {
            // Only update if metrics actually changed to prevent unnecessary re-renders
            if (JSON.stringify(prevMetrics) !== JSON.stringify(newMetrics)) {
              return newMetrics;
            }
            return prevMetrics;
          });
          
          // Calculate FPS based on metrics updates
          const now = performance.now();
          if (lastUpdateTime > 0) {
            const delta = now - lastUpdateTime;
            if (delta > 0) {
              fpsRef.current.push(1000 / delta);
              if (fpsRef.current.length > 10) {
                fpsRef.current.shift();
              }
              const avgFps = fpsRef.current.reduce((a, b) => a + b, 0) / fpsRef.current.length;
              setFps(Math.round(avgFps * 10) / 10);
            }
          }
          setLastUpdateTime(now);
          
          // Notify parent component of metrics change
          if (onSkinMetricsChange) {
            onSkinMetricsChange(newMetrics);
          }
        }
      );

      if (!success) {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        console.error('[SkinPanel] Failed to start skin analysis');
      }

      return success;
    } catch (error) {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      console.error('[SkinPanel] Error starting analysis:', error);
      return false;
    }
  }, []);

  const handleStartAnalysisRef = useRef(handleStartAnalysis);
  const handleStopAnalysisRef = useRef(handleStopAnalysis);

  useEffect(() => {
    handleStartAnalysisRef.current = handleStartAnalysis;
  }, [handleStartAnalysis]);

  useEffect(() => {
    handleStopAnalysisRef.current = handleStopAnalysis;
  }, [handleStopAnalysis]);

  // Cleanup effect to stop analysis when component unmounts
  useEffect(() => {
    return () => {
      if (isAnalyzingRef.current) {
        console.log('[SkinPanel] Cleaning up skin analysis on unmount');
        stopSkinAnalysis();
      }
    };
  }, []);

// Remove the problematic FPS calculation useEffect - we'll calculate FPS differently

  useEffect(() => {
    return () => {
      isAnalyzingRef.current = false;
      stopSkinAnalysis();
    };
  }, []);

  useEffect(() => {
    if (!canAnalyze && isAnalyzingRef.current) {
      void handleStopAnalysisRef.current();
    }
  }, [canAnalyze]);

  useEffect(() => {
    if (!overlayInitializedRef.current) {
      overlayInitializedRef.current = true;
      return;
    }
    if (!isAnalyzingRef.current) {
      return;
    }

    let cancelled = false;

    const restart = async () => {
      console.log('[SkinPanel] Restarting analysis due to overlay change:', showOverlay);
      await handleStopAnalysisRef.current();
      if (cancelled) return;
      await handleStartAnalysisRef.current(showOverlay);
    };

    void restart();

    return () => {
      cancelled = true;
    };
  }, [showOverlay]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 70) return 'bg-green-500';
    if (confidence >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getHealthScore = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Care';
  };

  const getHealthDescription = (score: number): string => {
    if (score >= 80) return 'Your skin looks healthy and well-maintained!';
    if (score >= 60) return 'Your skin is in good condition with room for improvement.';
    if (score >= 40) return 'Your skin needs some attention and care.';
    return 'Consider consulting a dermatologist for personalized advice.';
  };

  const getMetricDescription = (metric: string, score: number): string => {
    const descriptions = {
      texture: {
        high: 'Smooth and even texture',
        medium: 'Some texture irregularities',
        low: 'Uneven or rough texture'
      },
      redness: {
        high: 'Well-balanced skin tone',
        medium: 'Slight redness present',
        low: 'Noticeable redness or irritation'
      },
      shine: {
        high: 'Healthy natural glow',
        medium: 'Balanced oil production',
        low: 'May need hydration or oil control'
      }
    };
    
    const level = score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
    return descriptions[metric as keyof typeof descriptions][level];
  };

  const generateWellnessTips = (metrics: SkinMetrics): string[] => {
    const tips: string[] = [];
    
    // Texture-based tips
    if (metrics.texture < 50) {
      tips.push("💆‍♀️ Gentle exfoliation 2-3 times per week can improve skin texture");
      tips.push("🌿 Consider using products with alpha-hydroxy acids (AHAs)");
    } else if (metrics.texture >= 70) {
      tips.push("✨ Your skin texture looks great! Keep up your current routine");
    }
    
    // Tone/Redness tips
    if (metrics.redness > 60) {
      tips.push("🌿 Use soothing ingredients like aloe vera or chamomile");
      tips.push("❄️ Apply cool compresses to reduce inflammation");
      tips.push("🛡️ Always use broad-spectrum SPF 30+ sunscreen");
    } else if (metrics.redness < 40) {
      tips.push("💪 Your skin tone looks well-balanced!");
    }
    
    // Glow/Shine tips
    if (metrics.shine < 40) {
      tips.push("💧 Increase hydration with hyaluronic acid serums");
      tips.push("🥤 Drink more water throughout the day");
      tips.push("🌙 Use a hydrating night cream for better moisture retention");
    } else if (metrics.shine > 70) {
      tips.push("✨ Your skin has a beautiful natural glow!");
      tips.push("🧴 Consider oil-control products if shine is excessive");
    }
    
    // Overall health tips
    if (metrics.overall < 50) {
      tips.push("🕐 Establish a consistent morning and evening skincare routine");
      tips.push("😴 Get 7-9 hours of quality sleep for skin regeneration");
      tips.push("🥗 Eat a balanced diet rich in antioxidants and omega-3s");
    } else if (metrics.overall >= 70) {
      tips.push("🎉 Your skin health is excellent! Maintain your current habits");
    }
    
    // General wellness tips
    tips.push("🧘‍♀️ Practice stress management techniques like meditation");
    tips.push("🚭 Avoid smoking and limit alcohol consumption");
    tips.push("🏃‍♀️ Regular exercise improves circulation and skin health");
    
    return tips.slice(0, 4); // Return top 4 most relevant tips
  };

  // Update overlay canvas size when video element changes
  useEffect(() => {
    if (!showOverlay) {
      return;
    }

    const canvas = overlayCanvasRef.current;
    if (canvas && videoElement) {
      const width = videoElement.videoWidth || 640;
      const height = videoElement.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }
  }, [videoElement, showOverlay]);

  return (
    <div className="w-full space-y-4">
      {/* Overlay Canvas */}
      {showOverlay && (
        <div className="relative">
          <div className="relative w-full h-64 bg-gray-900 rounded-lg overflow-hidden">
            {/* Video Element */}
            {videoElement && (
              <video
                ref={(el) => {
                  if (el && videoElement && el !== videoElement) {
                    el.srcObject = videoElement.srcObject;
                    // Handle play promise to avoid AbortError
                    el.play().catch((error) => {
                      if (error.name !== 'AbortError') {
                        console.warn('[SkinPanel] Video play error:', error);
                      }
                    });
                  }
                }}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                style={{ transform: 'scaleX(-1)' }} // Mirror the video
              />
            )}
            
            {/* Overlay Canvas */}
            {showOverlay && (
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 10 }}
                width={640}
                height={480}
              />
            )}
            
            {/* Placeholder when no video */}
            {!videoElement && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gray-700 flex items-center justify-center">
                    <Eye className="w-8 h-8" />
                  </div>
                  <p className="text-sm">Start analysis to see video feed with overlay</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Analysis Card */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-900/20 to-blue-900/20 p-6 text-white shadow-lg backdrop-blur-sm">
      {/* Header with Wellness Focus */}
      <div className="flex items-center justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Skin Wellness Analysis</h2>
            <p className="text-sm text-gray-300">Your personal skin health advisor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInfoBox(!showInfoBox)}
            className="text-gray-300 hover:text-white"
          >
            <Info className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm text-gray-300">
              {isAnalyzing ? 'Analyzing' : canAnalyze ? 'Ready' : 'Waiting'}
            </span>
          </div>
        </div>
      </div>

      {/* Information Box */}
      {showInfoBox && (
        <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-400/30">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-400" />
              <h3 className="font-semibold text-blue-200">Understanding Your Skin Analysis</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfoBox(false)}
              className="text-blue-300 hover:text-white p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3 text-sm text-blue-100">
            <div>
              <strong className="text-blue-200">Texture:</strong> Measures skin smoothness and evenness. Higher scores indicate smoother, more refined skin.
            </div>
            <div>
              <strong className="text-blue-200">Tone:</strong> Analyzes skin color balance and redness. Lower scores suggest better tone balance.
            </div>
            <div>
              <strong className="text-blue-200">Glow:</strong> Evaluates natural radiance and oil balance. Optimal range indicates healthy skin glow.
            </div>
            <div>
              <strong className="text-blue-200">Confidence:</strong> Shows analysis reliability. Higher confidence means more accurate results.
            </div>
          </div>
        </div>
      )}

      {/* Control Section */}
      <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Badge
              variant={metrics.source === 'mediapipe' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {metrics.source === 'mediapipe' ? '🧠 AI-Powered' : '✨ Basic'}
            </Badge>
            {isAnalyzing && (
              <Badge variant="outline" className="text-xs text-white">
                {fps} FPS
              </Badge>
            )}
          </div>
          <div className="text-xs text-gray-300">
            Analysis Mode: <span className="font-semibold text-white">
              {isAnalyzing ? (metrics.source === 'mediapipe' ? 'AI-Enhanced' : 'Basic') : 'Idle'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!isAnalyzing ? (
              <Button
                onClick={() => void handleStartAnalysis()}
                disabled={!canAnalyze}
                size="lg"
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg"
              >
                <Play className="h-5 w-5" />
                Start Wellness Analysis
              </Button>
            ) : (
              <Button
                onClick={() => { void handleStopAnalysis(); }}
                variant="destructive"
                size="lg"
                className="flex items-center gap-2 font-semibold px-6 py-3 rounded-lg shadow-lg"
              >
                <Square className="h-5 w-5" />
                Stop Analysis
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="overlay-toggle"
              checked={showOverlay}
              onCheckedChange={(checked) => {
                setShowOverlay(checked);
              }}
              disabled={!isAnalyzing}
              aria-label="Toggle overlay"
            />
            <Label htmlFor="overlay-toggle" className="text-sm flex items-center gap-2 text-gray-300 font-medium">
              {showOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Visual Overlay
            </Label>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-6">
        {/* Overall Health Card */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-white/5 to-white/10 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Overall Skin Wellness</h3>
                <p className="text-sm text-gray-300">Your skin health assessment</p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getScoreColor(metrics.overall)}`}>
                {getHealthScore(metrics.overall)}
              </div>
              <Badge variant="outline" className="text-xs mt-1">
                {getScoreLabel(metrics.overall)}
              </Badge>
            </div>
          </div>
          <Progress value={metrics.overall} className="h-3 mb-3" />
          <div className="text-sm text-gray-300 text-center bg-white/5 rounded-lg p-3">
            {getHealthDescription(metrics.overall)}
          </div>
        </div>

        {/* Individual Metrics */}
        <div className="grid grid-cols-3 gap-4">
          {/* Texture */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="p-1.5 rounded-full bg-blue-500/20">
                <Activity className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-gray-200">Texture</span>
            </div>
            <div className={`text-xl font-bold mb-2 ${getScoreColor(metrics.texture)}`}>
              {getScoreLabel(metrics.texture)}
            </div>
            <Progress value={metrics.texture} className="h-2 mb-3" />
            <div className="text-xs text-gray-400">
              {getMetricDescription('texture', metrics.texture)}
            </div>
          </div>

          {/* Tone */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="p-1.5 rounded-full bg-pink-500/20">
                <Droplets className="h-4 w-4 text-pink-400" />
              </div>
              <span className="text-sm font-semibold text-gray-200">Tone</span>
            </div>
            <div className={`text-xl font-bold mb-2 ${getScoreColor(metrics.redness)}`}>
              {getScoreLabel(metrics.redness)}
            </div>
            <Progress value={metrics.redness} className="h-2 mb-3" />
            <div className="text-xs text-gray-400">
              {getMetricDescription('redness', metrics.redness)}
            </div>
          </div>

          {/* Glow */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="p-1.5 rounded-full bg-yellow-500/20">
                <Sun className="h-4 w-4 text-yellow-400" />
              </div>
              <span className="text-sm font-semibold text-gray-200">Glow</span>
            </div>
            <div className={`text-xl font-bold mb-2 ${getScoreColor(metrics.shine)}`}>
              {getScoreLabel(metrics.shine)}
            </div>
            <Progress value={metrics.shine} className="h-2 mb-3" />
            <div className="text-xs text-gray-400">
              {getMetricDescription('shine', metrics.shine)}
            </div>
          </div>
        </div>

        {/* Confidence and Status */}
        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span className="text-sm font-semibold text-gray-200">Analysis Confidence</span>
            </div>
            <span className="text-sm font-bold text-white">{metrics.confidence}%</span>
          </div>
          <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getConfidenceColor(metrics.confidence)}`}
              style={{ width: `${metrics.confidence}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-2 text-center">
            {metrics.confidence >= 70 ? 'High reliability' : metrics.confidence >= 40 ? 'Moderate reliability' : 'Low reliability - improve lighting'}
          </div>
        </div>

        {/* Status Messages */}
        {!canAnalyze && (
          <div className="p-4 rounded-lg border border-dashed border-white/20 bg-white/5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-300">Camera Access Required</span>
            </div>
            <p className="text-xs text-gray-400">Start emotion analysis to unlock real-time skin wellness metrics</p>
          </div>
        )}

        {isAnalyzing && metrics.confidence < 30 && (
          <div className="p-4 rounded-lg border border-yellow-400/40 bg-yellow-500/10">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-200">Low Analysis Confidence</span>
            </div>
            <p className="text-xs text-yellow-200">Improve lighting and face alignment for better readings</p>
          </div>
        )}

        {/* Wellness Tips */}
        {isAnalyzing && metrics.confidence >= 30 && wellnessTips.length > 0 && (
          <div className="p-4 rounded-lg border border-green-400/40 bg-green-500/10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-green-400" />
              <span className="text-sm font-semibold text-green-200">Personalized Wellness Tips</span>
            </div>
            <div className="space-y-2">
              {wellnessTips.map((tip, index) => (
                <div key={index} className="flex items-start gap-2 text-xs text-green-200">
                  <div className="w-1 h-1 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default SkinPanel;

/**
 * Emotion Detection Service - MediaPipe Tasks Implementation
 * With graceful fallback to simplified analysis
 */

"use client";

import { mapBlendshapesToEmotionMetrics, createSimplifiedEmotionMetrics, type EmotionMetrics } from '../lib/emotionMapping';

// Re-export EmotionResult as EmotionMetrics for compatibility
export type EmotionResult = EmotionMetrics;


// Suppress noisy console.error logs emitted by MediaPipe when loading delegates
const SUPPRESSED_MEDIAPIPE_ERRORS = [
  'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.'
];
let mediapipeConsolePatched = false;
function suppressMediapipeNoise() {
  if (typeof window === 'undefined' || mediapipeConsolePatched) {
    return;
  }
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    if (SUPPRESSED_MEDIAPIPE_ERRORS.some(pattern => message.includes(pattern))) {
      console.info('[EmotionDetection] (suppressed)', message);
      return;
    }
    originalError(...args);
  };
  mediapipeConsolePatched = true;
}
// MediaPipe Tasks variables
let landmarker: any;
let running = false;
let lastTs = 0;
let landmarkerPendingLogged = false;
let videoNotReadyLogged = false;

type StartOpts = {
  videoEl: HTMLVideoElement;
  targetFps?: number;          // default 12
  width?: number;              // optional downscale
  height?: number;             // optional downscale
  onLandmarks?: (landmarks: number[][]) => void; // callback for landmarks
};

/**
 * Start emotion analysis with MediaPipe Tasks (with fallback)
 */
export async function startEmotionAnalysis(
  { videoEl, targetFps = 12, width, height, onLandmarks }: StartOpts, 
  onUpdate: (m: EmotionMetrics) => void
) {
  suppressMediapipeNoise();

  // 1) getUserMedia with moderate resolution for performance
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: width ?? 640 },
      height: { ideal: height ?? 360 },
      frameRate: { ideal: targetFps, max: targetFps }
    },
    audio: false
  });
  videoEl.srcObject = stream;
  await videoEl.play();

  // 2) Load MediaPipe Tasks (client-only)
  try {
    console.log('[EmotionDetection] 🚀 Loading MediaPipe Tasks...');
    const vision = await import("@mediapipe/tasks-vision");
    const { FilesetResolver, FaceLandmarker } = vision as any;

    const filesetResolver = await FilesetResolver.forVisionTasks(
      // Official CDN for WASM files
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.13/wasm"
    );

    landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      },
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
      runningMode: "VIDEO",
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    running = true;
    console.log('[EmotionDetection] ✅ MediaPipe Tasks initialized successfully!');

    const process = () => {
      if (!running) return;
      const now = performance.now();
      
      // Throttle to ~targetFps
      if (now - lastTs >= 1000 / targetFps) {
        lastTs = now;
        try {
          if (!landmarker) {
            if (!landmarkerPendingLogged) {
              console.warn('[EmotionDetection] Landmarker not ready yet, skipping frame');
              landmarkerPendingLogged = true;
            }
          } else if (videoEl.readyState < 2 || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
            if (!videoNotReadyLogged && process.env.NODE_ENV === 'development') {
              console.debug('[EmotionDetection] Video frame not ready, waiting...');
              videoNotReadyLogged = true;
            }
          } else {
            landmarkerPendingLogged = false;
            videoNotReadyLogged = false;
            const results = landmarker.detectForVideo(videoEl, now);
            const face = results?.faceBlendshapes?.[0];
            const faceLandmarks = results?.faceLandmarks?.[0];
            const presence = faceLandmarks ? 1 : 0;

            if (onLandmarks && faceLandmarks) {
              onLandmarks(faceLandmarks);
            }

            if (face?.categories?.length) {
              const blendshapes = face.categories.map((c: any) => ({
                categoryName: c.categoryName,
                score: c.score
              }));
              const metrics = mapBlendshapesToEmotionMetrics(blendshapes, presence);
              onUpdate(metrics);
            } else if (presence === 0) {
              onUpdate({
                emotions: { happiness: 0.1, sadness: 0.1, anger: 0.1, fear: 0.1, surprise: 0.1, disgust: 0.1, neutral: 0.4 },
                valence: 0, arousal: 0, confidence: 0.2, dominantEmotion: "neutral", source: "mediapipe-blendshapes"
              });
            }
          }
        } catch (err) {
          console.debug('[EmotionDetection] Frame processing error suppressed:', err);
        }
      }
      requestAnimationFrame(process);
    };

    requestAnimationFrame(process);
    
  } catch (e) {
    // FALLBACK: Use simplified analysis
    console.warn('[EmotionDetection] ⚠️ MediaPipe Tasks unavailable, using simplified analysis:', e);
    startSimplifiedFallback(videoEl, targetFps, onUpdate);
  }
}

/**
 * Stop emotion analysis and cleanup
 */
export function stopEmotionAnalysis(videoEl?: HTMLVideoElement) {
  running = false;
  landmarkerPendingLogged = false;
  videoNotReadyLogged = false;
  if (landmarker?.close) {
    landmarker.close();
  }
  landmarker = undefined;
  
  const stream = videoEl?.srcObject as MediaStream | undefined;
  stream?.getTracks().forEach(t => t.stop());
  
  if (videoEl) {
    videoEl.srcObject = null;
  }
  
  console.log('[EmotionDetection] 🛑 Analysis stopped and cleaned up');
}

/**
 * Simplified fallback implementation
 */
function startSimplifiedFallback(
  videoEl: HTMLVideoElement, 
  targetFps: number, 
  onUpdate: (m: EmotionMetrics) => void
) {
  console.log('[EmotionDetection] 🔄 Using simplified fallback analysis');
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    console.error('[EmotionDetection] ❌ Canvas context not available');
    return;
  }
  
  const interval = setInterval(() => {
    if (!running) {
      clearInterval(interval);
      return;
    }
    
    try {
      canvas.width = videoEl.videoWidth || 640;
      canvas.height = videoEl.videoHeight || 480;
      
      // Draw current video frame
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      
      // Get image data for analysis
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Calculate brightness and color variance
      const brightness = calculateBrightness(data);
      const colorVariance = calculateColorVariance(data);
      
      // Generate emotion metrics
      const metrics = createSimplifiedEmotionMetrics(brightness, colorVariance);
      onUpdate(metrics);
      
    } catch (error) {
      console.warn('[EmotionDetection] Simplified analysis error:', error);
      // Return neutral emotions on error
      onUpdate(createSimplifiedEmotionMetrics());
    }
  }, Math.round(1000 / targetFps));
}

// Helper functions for simplified analysis
function calculateBrightness(data: Uint8ClampedArray): number {
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalBrightness += (r + g + b) / 3;
  }
  return totalBrightness / (data.length / 4) / 255; // Normalize to 0-1
}

function calculateColorVariance(data: Uint8ClampedArray): number {
  let variance = 0;
  const samples = Math.min(1000, data.length / 4); // Sample for performance
  
  for (let i = 0; i < samples * 4; i += 16) { // Every 4th pixel
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const diff = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    variance += diff;
  }
  
  return variance / samples / 255; // Normalize
}

// Legacy class wrapper for backward compatibility
export class EmotionDetectionService {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private isRunning = false;
  private onResultCallback?: (result: EmotionResult) => void;

  constructor() {
    console.log('[EmotionDetection] ✅ MediaPipe Tasks service initialized');
  }

  async startDetection(
    videoElement: HTMLVideoElement, 
    onResult: (result: EmotionResult) => void,
    onLandmarks?: (landmarks: number[][]) => void
  ) {
    this.videoElement = videoElement;
    this.onResultCallback = onResult;
    this.isRunning = true;

    try {
      await startEmotionAnalysis(
        { 
          videoEl: videoElement, 
          targetFps: 12, 
          width: 640, 
          height: 360,
          onLandmarks: onLandmarks
        },
        (metrics) => {
          if (this.isRunning && this.onResultCallback) {
            this.onResultCallback(metrics);
          }
        }
      );
      return true;
    } catch (error) {
      console.error('[EmotionDetection] Failed to start detection:', error);
      this.isRunning = false;
      return false;
    }
  }

  stopDetection() {
    this.isRunning = false;
    stopEmotionAnalysis(this.videoElement || undefined);
    this.onResultCallback = undefined;
    this.videoElement = null;
    console.log('[EmotionDetection] 🛑 Detection stopped (legacy method)');
  }
}

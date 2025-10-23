export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface RegionScores {
  texture: number;
  redness: number;
  shine: number;
}

export interface ROIRegion {
  leftCheek: number[]; // normalized coordinates (0-1)
  rightCheek: number[];
  forehead: number[];
}

export interface SkinMetrics {
  texture: number;
  redness: number;
  shine: number;
  overall: number;
  confidence: number;
  source: 'mediapipe' | 'fallback';
  regions?: {
    leftCheek: RegionScores;
    rightCheek: RegionScores;
    forehead: RegionScores;
  };
}

export interface SkinComputationOptions {
  /** Average confidence from recent frames to smooth dynamic confidence. */
  recentConfidenceAverage?: number;
}

const MIN_SAMPLES_FOR_ANALYSIS = 30;
const TEXTURE_KERNEL_SIZE = 5;
const REQUIRED_INDICES = new Set<number>([
  8, 9, 10, 31, 35, 41, 42, 46, 52, 53, 55, 65, 107, 116, 117, 118, 119, 120, 121, 124, 126,
  142, 143, 144, 145, 146, 147, 151, 228, 229, 230, 345, 346, 347, 348, 349, 350,
  355, 371, 372, 373, 374, 375, 376
]);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp100 = (value: number) => Math.max(0, Math.min(100, value));

export function extractNormalizedROIs(landmarks: number[][] | null | undefined): ROIRegion | null {
  if (!landmarks || landmarks.length < 468) {
    return null;
  }

  for (const index of REQUIRED_INDICES) {
    if (!landmarks[index] || landmarks[index].length < 2) {
      return null;
    }
  }

  const mapPoints = (indices: number[]) =>
    indices.flatMap((i) => {
      const [x, y] = landmarks[i];
      return [clamp01(x), clamp01(y)];
    });

  return {
    leftCheek: mapPoints([116, 117, 118, 119, 120, 121, 126, 142, 143, 144, 145, 146, 147]),
    rightCheek: mapPoints([345, 346, 347, 348, 349, 350, 355, 371, 372, 373, 374, 375, 376]),
    forehead: mapPoints([10, 151, 9, 8, 107, 55, 65, 52, 53, 46, 124, 35, 41, 42, 31, 228, 229, 230])
  };
}

export function scaleNormalizedROI(points: number[], width: number, height: number): number[] {
  const scaled: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    scaled.push(clamp01(points[i]) * width, clamp01(points[i + 1]) * height);
  }
  return scaled;
}

interface ROIRegionPixels {
  leftCheek: number[];
  rightCheek: number[];
  forehead: number[];
}

export function computeSkinMetrics(
  imageData: ImageDataLike,
  rois: ROIRegion | null,
  options: SkinComputationOptions = {}
): SkinMetrics {
  const { data, width, height } = imageData;

  if (!rois) {
    return calculateFallbackMetrics(data, width, height);
  }

  const leftCheekPixels = scaleNormalizedROI(rois.leftCheek, width, height);
  const rightCheekPixels = scaleNormalizedROI(rois.rightCheek, width, height);
  const foreheadPixels = scaleNormalizedROI(rois.forehead, width, height);

  const leftCheekMetrics = calculateEnhancedROIMetrics(data, width, height, leftCheekPixels);
  const rightCheekMetrics = calculateEnhancedROIMetrics(data, width, height, rightCheekPixels);
  const foreheadMetrics = calculateEnhancedROIMetrics(data, width, height, foreheadPixels);

  const texture = leftCheekMetrics.texture * 0.4 + rightCheekMetrics.texture * 0.4 + foreheadMetrics.texture * 0.2;
  const redness = leftCheekMetrics.redness * 0.5 + rightCheekMetrics.redness * 0.5;
  const shine = leftCheekMetrics.shine * 0.3 + rightCheekMetrics.shine * 0.3 + foreheadMetrics.shine * 0.4;

  const textureScore = clamp100(texture);
  const rednessScore = clamp100(redness);
  const shineScore = clamp100(shine);

  const rednessBalance = 100 - rednessScore;
  const shineBalance = clamp100(100 - Math.abs(shineScore - 55) * 1.6);
  const overall = textureScore * 0.45 + rednessBalance * 0.35 + shineBalance * 0.2;

  const roundRegion = (regionMetrics: RegionScores): RegionScores => ({
    texture: Math.round(clamp100(regionMetrics.texture)),
    redness: Math.round(clamp100(regionMetrics.redness)),
    shine: Math.round(clamp100(regionMetrics.shine))
  });

  const confidence = calculateEnhancedConfidence(data, width, height, {
    leftCheek: leftCheekPixels,
    rightCheek: rightCheekPixels,
    forehead: foreheadPixels
  }, options.recentConfidenceAverage);

  return {
    texture: Math.round(textureScore),
    redness: Math.round(rednessScore),
    shine: Math.round(shineScore),
    overall: Math.round(clamp100(overall)),
    confidence: Math.round(clamp100(confidence)),
    source: 'mediapipe',
    regions: {
      leftCheek: roundRegion(leftCheekMetrics),
      rightCheek: roundRegion(rightCheekMetrics),
      forehead: roundRegion(foreheadMetrics)
    }
  };
}

export function createEmaSmoother(alpha = 0.25) {
  let previous: SkinMetrics | null = null;
  return (metrics: SkinMetrics): SkinMetrics => {
    if (!previous) {
      previous = metrics;
      return metrics;
    }

    const smoothed: SkinMetrics = {
      texture: Math.round(previous.texture * (1 - alpha) + metrics.texture * alpha),
      redness: Math.round(previous.redness * (1 - alpha) + metrics.redness * alpha),
      shine: Math.round(previous.shine * (1 - alpha) + metrics.shine * alpha),
      overall: Math.round(previous.overall * (1 - alpha) + metrics.overall * alpha),
      confidence: Math.round(previous.confidence * (1 - alpha) + metrics.confidence * alpha),
      source: metrics.source,
      regions: metrics.regions
    };

    previous = smoothed;
    return smoothed;
  };
}

export function normalizeLighting(imageData: ImageDataLike): ImageDataLike {
  const { data, width, height } = imageData;
  const kernelSize = 15;
  const halfKernel = Math.floor(kernelSize / 2);

  for (let y = halfKernel; y < height - halfKernel; y++) {
    for (let x = halfKernel; x < width - halfKernel; x++) {
      let localSum = 0;
      let count = 0;

      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          localSum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          count++;
        }
      }

      const localMean = localSum / count;
      const globalMean = 128;
      const factor = globalMean / localMean;
      const idx = (y * width + x) * 4;

      data[idx] = Math.min(255, Math.max(0, data[idx] * factor));
      data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] * factor));
      data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] * factor));
    }
  }

  return imageData;
}

function calculateEnhancedROIMetrics(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roiPoints: number[]
): RegionScores {
  if (roiPoints.length < 6) {
    return { texture: 50, redness: 50, shine: 50 };
  }

  const samples = sampleROIPixelsEnhanced(data, width, height, roiPoints);
  if (samples.length < MIN_SAMPLES_FOR_ANALYSIS) {
    return { texture: 50, redness: 50, shine: 50 };
  }

  const texture = calculateEnhancedTexture(samples, data, width, height, roiPoints);
  const redness = calculateEnhancedRedness(samples);
  const shine = calculateEnhancedShine(samples);

  return { texture, redness, shine };
}

function calculateFallbackMetrics(data: Uint8ClampedArray, width: number, height: number): SkinMetrics {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const regionSize = Math.min(width, height) / 3;

  const samples: number[][] = [];
  const timestamp = Date.now();

  for (let y = centerY - regionSize; y < centerY + regionSize; y += 3) {
    for (let x = centerX - regionSize; x < centerX + regionSize; x += 3) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 30 && brightness < 220) {
          samples.push([r, g, b]);
        }
      }
    }
  }

  const baseTexture = calculateTexture(samples);
  const baseRedness = calculateRedness(samples);
  const baseShine = calculateShine(samples);

  const textureVariation = Math.sin(timestamp / 1000) * 5 + (Math.random() - 0.5) * 10;
  const rednessVariation = Math.cos(timestamp / 1200) * 4 + (Math.random() - 0.5) * 8;
  const shineVariation = Math.sin(timestamp / 800) * 6 + (Math.random() - 0.5) * 12;

  const texture = clamp100(baseTexture + textureVariation);
  const redness = clamp100(baseRedness + rednessVariation);
  const shine = clamp100(baseShine + shineVariation);
  const overall = texture * 0.4 + (100 - redness) * 0.35 + shine * 0.25;
  const confidence = Math.max(30, calculateConfidence(data, width, height) * 0.6);

  return {
    texture: Math.round(texture),
    redness: Math.round(redness),
    shine: Math.round(shine),
    overall: Math.round(overall),
    confidence: Math.round(confidence),
    source: 'fallback'
  };
}

function calculateEnhancedTexture(
  samples: number[][],
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roiPoints: number[]
): number {
  if (samples.length < 9) return 50;

  const laplacianVariance = calculateTexture(samples);
  const lbpScore = calculateLBPScore(samples);
  const gradientScore = calculateGradientScore(data, width, height, roiPoints);
  const combinedScore = laplacianVariance * 0.5 + lbpScore * 0.3 + gradientScore * 0.2;
  return clamp100(combinedScore);
}

function calculateEnhancedRedness(samples: number[][]): number {
  if (samples.length === 0) return 50;

  let totalRedness = 0;
  let validSamples = 0;

  for (const [r, g, b] of samples) {
    const method1 = r / (g + b + 1);
    const method2 = (r - g) / (r + g + b + 1);
    const method3 = r / (Math.max(r, g, b) + 1);
    const combinedRedness = method1 * 0.5 + method2 * 0.3 + method3 * 0.2;
    if (combinedRedness > 0.3 && combinedRedness < 2) {
      totalRedness += combinedRedness;
      validSamples++;
    }
  }

  if (validSamples === 0) return 50;
  const avgRedness = totalRedness / validSamples;
  const minRedness = 0.35;
  const maxRedness = 1.4;
  const normalized = ((avgRedness - minRedness) / (maxRedness - minRedness)) * 100;
  return clamp100(normalized);
}

function calculateEnhancedShine(samples: number[][]): number {
  if (samples.length === 0) return 50;

  let highlightCount = 0;
  let totalSamples = 0;

  for (const [r, g, b] of samples) {
    const [h, s, v] = rgbToHsv(r, g, b);
    const isHighlight = v > 0.75 && s < 0.25;
    const isSpecular = v > 0.8 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
    const isOily = v > 0.7 && s < 0.4 && h > 20 && h < 60;
    if (isHighlight || isSpecular || isOily) {
      highlightCount++;
    }
    totalSamples++;
  }

  const highlightRatio = totalSamples === 0 ? 0 : highlightCount / totalSamples;
  const normalized = (highlightRatio - 0.05) * 200;
  return Math.round(clamp100(normalized));
}

function calculateTexture(samples: number[][]): number {
  if (samples.length < 9) return 50;

  const grayscale = samples.map(([r, g, b]) => (r + g + b) / 3);
  let variance = 0;
  const kernelSize = TEXTURE_KERNEL_SIZE;
  const halfKernel = Math.floor(kernelSize / 2);

  for (let i = halfKernel; i < grayscale.length - halfKernel; i++) {
    const window = grayscale.slice(i - halfKernel, i + halfKernel + 1);
    const mean = window.reduce((sum, value) => sum + value, 0) / kernelSize;
    const localVariance = window.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / kernelSize;
    variance += localVariance;
  }

  const avgVariance = variance / (grayscale.length - kernelSize + 1);
  return clamp100(100 - (avgVariance / 100) * 50);
}

function calculateRedness(samples: number[][]): number {
  if (samples.length === 0) return 50;
  let totalRedness = 0;
  for (const [r, g, b] of samples) {
    totalRedness += r / (g + b + 1);
  }
  const avgRedness = totalRedness / samples.length;
  return clamp100((avgRedness - 0.8) * 100);
}

function calculateShine(samples: number[][]): number {
  if (samples.length === 0) return 50;
  let highlightCount = 0;
  for (const [r, g, b] of samples) {
    const [h, s, v] = rgbToHsv(r, g, b);
    if (v > 0.7 && s < 0.3) {
      highlightCount++;
    }
  }
  return Math.round((highlightCount / samples.length) * 100);
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : diff / max;
  const v = max;
  return [h, s, v];
}

function calculateConfidence(data: Uint8ClampedArray, width: number, height: number): number {
  let totalBrightness = 0;
  let brightnessVariance = 0;

  for (let i = 0; i < data.length; i += 64) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    totalBrightness += brightness;
  }

  const avgBrightness = totalBrightness / (data.length / 64);

  for (let i = 0; i < data.length; i += 64) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    brightnessVariance += Math.pow(brightness - avgBrightness, 2);
  }

  const variance = brightnessVariance / (data.length / 64);
  const brightnessScore = avgBrightness > 50 && avgBrightness < 200 ? 50 : 20;
  const contrastScore = variance > 100 ? 30 : 10;
  return clamp100(brightnessScore + contrastScore);
}

function calculateEnhancedConfidence(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  rois: ROIRegionPixels,
  recentConfidenceAverage?: number
): number {
  let confidence = calculateConfidence(data, width, height);

  const leftCheekSamples = sampleROIPixelsEnhanced(data, width, height, rois.leftCheek).length;
  const rightCheekSamples = sampleROIPixelsEnhanced(data, width, height, rois.rightCheek).length;
  const foreheadSamples = sampleROIPixelsEnhanced(data, width, height, rois.forehead).length;

  const totalSamples = leftCheekSamples + rightCheekSamples + foreheadSamples;
  const sampleQuality = Math.min(100, (totalSamples / 200) * 100);
  confidence = confidence * 0.6 + sampleQuality * 0.4;

  if (typeof recentConfidenceAverage === 'number') {
    confidence = confidence * 0.8 + clamp100(recentConfidenceAverage) * 0.2;
  }

  return clamp100(confidence);
}

function sampleROIPixelsEnhanced(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roiPoints: number[]
): number[][] {
  const samples: number[][] = [];

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < roiPoints.length; i += 2) {
    minX = Math.min(minX, roiPoints[i]);
    maxX = Math.max(maxX, roiPoints[i]);
    minY = Math.min(minY, roiPoints[i + 1]);
    maxY = Math.max(maxY, roiPoints[i + 1]);
  }

  const roiArea = (maxX - minX) * (maxY - minY);
  const stepSize = roiArea > 10000 ? 3 : 2;

  for (let y = Math.floor(minY); y <= Math.floor(maxY); y += stepSize) {
    for (let x = Math.floor(minX); x <= Math.floor(maxX); x += stepSize) {
      if (x >= 0 && x < width && y >= 0 && y < height && isPointInPolygon(x, y, roiPoints)) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 20 && brightness < 240) {
          samples.push([r, g, b]);
        }
      }
    }
  }

  return samples;
}

function sampleROIPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roiPoints: number[]
): number[][] {
  const samples: number[][] = [];

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < roiPoints.length; i += 2) {
    minX = Math.min(minX, roiPoints[i]);
    maxX = Math.max(maxX, roiPoints[i]);
    minY = Math.min(minY, roiPoints[i + 1]);
    maxY = Math.max(maxY, roiPoints[i + 1]);
  }

  for (let y = Math.floor(minY); y <= Math.floor(maxY); y += 4) {
    for (let x = Math.floor(minX); x <= Math.floor(maxX); x += 4) {
      if (x >= 0 && x < width && y >= 0 && y < height && isPointInPolygon(x, y, roiPoints)) {
        const idx = (y * width + x) * 4;
        samples.push([data[idx], data[idx + 1], data[idx + 2]]);
      }
    }
  }

  return samples;
}

function isPointInPolygon(x: number, y: number, points: number[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i];
    const yi = points[i + 1];
    const xj = points[j];
    const yj = points[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function calculateLBPScore(samples: number[][]): number {
  if (samples.length < 9) return 50;
  const grayscale = samples.map(([r, g, b]) => (r + g + b) / 3);
  let uniformPatterns = 0;
  const totalPatterns = grayscale.length - 8;

  for (let i = 4; i < grayscale.length - 4; i++) {
    const center = grayscale[i];
    const neighbors = [
      grayscale[i - 4],
      grayscale[i - 3],
      grayscale[i - 2],
      grayscale[i + 2],
      grayscale[i + 3],
      grayscale[i + 4],
      grayscale[i - 1],
      grayscale[i + 1]
    ];

    let pattern = 0;
    for (let j = 0; j < 8; j++) {
      if (neighbors[j] >= center) {
        pattern |= 1 << j;
      }
    }

    if (countTransitions(pattern) <= 2) {
      uniformPatterns++;
    }
  }

  const uniformity = uniformPatterns / totalPatterns;
  return Math.round(uniformity * 100);
}

function countTransitions(pattern: number): number {
  let transitions = 0;
  const binary = pattern.toString(2).padStart(8, '0');
  for (let i = 0; i < 8; i++) {
    const current = binary[i];
    const next = binary[(i + 1) % 8];
    if (current !== next) {
      transitions++;
    }
  }
  return transitions;
}

function calculateGradientScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roiPoints: number[]
): number {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (let i = 0; i < roiPoints.length; i += 2) {
    minX = Math.min(minX, roiPoints[i]);
    maxX = Math.max(maxX, roiPoints[i]);
    minY = Math.min(minY, roiPoints[i + 1]);
    maxY = Math.max(maxY, roiPoints[i + 1]);
  }

  const gradients: number[] = [];

  for (let y = Math.floor(minY) + 1; y < Math.floor(maxY) - 1; y += 2) {
    for (let x = Math.floor(minX) + 1; x < Math.floor(maxX) - 1; x += 2) {
      if (x >= 1 && x < width - 1 && y >= 1 && y < height - 1 && isPointInPolygon(x, y, roiPoints)) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = (r + g + b) / 3;

        const gx = Math.abs(data[idx - 4] + data[idx + 4] - 2 * brightness);
        const gy = Math.abs(data[idx - width * 4] + data[idx + width * 4] - 2 * brightness);
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        gradients.push(magnitude);
      }
    }
  }

  if (gradients.length === 0) return 50;

  const mean = gradients.reduce((sum, g) => sum + g, 0) / gradients.length;
  const variance = gradients.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / gradients.length;
  return clamp100(100 - (variance / 100) * 30);
}

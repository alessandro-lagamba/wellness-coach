/**
 * Skin Analysis Service - Real-time skin metrics
 * Uses MediaPipe FaceMesh (or provided landmarks) + shared analysis core.
 */

"use client";

import {
  computeSkinMetrics,
  createEmaSmoother,
  extractNormalizedROIs,
  normalizeLighting,
  scaleNormalizedROI,
  type ROIRegion,
  type SkinMetrics
} from '@wellness-coach/shared';

type LandmarkPoint = number[] | { x: number; y: number };
type LandmarkSource = LandmarkPoint[] | null | (() => LandmarkPoint[] | null);

export interface SkinAnalysisOptions {
  videoEl: HTMLVideoElement;
  landmarks?: LandmarkSource;
  targetFps?: number;
  enableOverlay?: boolean;
  overlayCanvas?: HTMLCanvasElement;
}

export interface OverlayData {
  textureZones: { points: number[]; intensity: number; color: string }[];
  rednessZones: { points: number[]; intensity: number; color: string }[];
  shineZones: { points: number[]; intensity: number; color: string }[];
  focusAreas: { points: number[]; recommendation: string; priority: 'high' | 'medium' | 'low' }[];
}

// Processing state
let isRunning = false;
let lastAnalysisTime = 0;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let overlayCanvas: HTMLCanvasElement | null = null;
let overlayCtx: CanvasRenderingContext2D | null = null;
let overlayLogState: 'unknown' | 'missing' | 'available' = 'unknown';

const EMA_ALPHA = 0.25;
const LIGHTING_NORMALIZATION_ENABLED = true;

// FaceMesh tracker state
type FaceMeshModule = typeof import('@mediapipe/face_mesh');
type FaceMeshInstance = InstanceType<FaceMeshModule['FaceMesh']>;

let faceMeshLoader: Promise<FaceMeshInstance | null> | null = null;
let faceMeshInstance: FaceMeshInstance | null = null;
let faceMeshProcessing = false;
let faceMeshLastLandmarks: number[][] | null = null;
let faceMeshEnabled = false;

export async function startSkinAnalysis(
  options: SkinAnalysisOptions,
  onUpdate: (metrics: SkinMetrics) => void
): Promise<boolean> {
  const { videoEl, landmarks, targetFps = 2, enableOverlay = false, overlayCanvas: providedOverlayCanvas } = options;

  if (isRunning) {
    console.warn('[SkinAnalysis] Already running');
    return false;
  }

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.setAttribute('willReadFrequently', 'true');
    ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[SkinAnalysis] Canvas context not available');
      return false;
    }
  }

  if (enableOverlay) {
    overlayCanvas = providedOverlayCanvas ?? document.createElement('canvas');
    overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) {
      console.error('[SkinAnalysis] Overlay context not available');
      return false;
    }
  }

  isRunning = true;
  lastAnalysisTime = 0;
  overlayLogState = 'unknown';
  faceMeshEnabled = enableOverlay;

  const ema = createEmaSmoother(EMA_ALPHA);
  const history: SkinMetrics[] = [];

  const processFrame = async (): Promise<void> => {
    if (!isRunning || !canvas || !ctx) return;

    const now = performance.now();
    if (now - lastAnalysisTime < 1000 / targetFps) {
      requestAnimationFrame(() => void processFrame());
      return;
    }
    lastAnalysisTime = now;

    const videoReady = videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0;
    if (!videoReady) {
      requestAnimationFrame(() => void processFrame());
      return;
    }

    try {
      if (faceMeshEnabled) {
        await runFaceMesh(videoEl);
      }

      const fallbackLandmarks = sanitizeLandmarks(resolveLandmarkSource(landmarks));
      const detectedLandmarks = faceMeshEnabled ? faceMeshLastLandmarks ?? fallbackLandmarks : fallbackLandmarks;
      const rois = detectedLandmarks ? extractNormalizedROIs(detectedLandmarks) : null;

      const status: typeof overlayLogState = rois ? 'available' : 'missing';
      if (overlayLogState !== status) {
        console.log('[SkinAnalysis] ROI status:', {
          hasLandmarks: Array.isArray(detectedLandmarks) && detectedLandmarks.length > 0,
          roisAvailable: !!rois
        });
        overlayLogState = status;
      }

      const videoWidth = videoEl.videoWidth;
      const videoHeight = videoEl.videoHeight;
      const maxSize = 320;
      const scale = Math.min(maxSize / videoWidth, maxSize / videoHeight, 1);

      canvas.width = Math.floor(videoWidth * scale);
      canvas.height = Math.floor(videoHeight * scale);
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (LIGHTING_NORMALIZATION_ENABLED) {
        imageData = normalizeLighting(imageData);
      }

      const recentConfidence =
        history.length >= 3 ? history.slice(-3).reduce((sum, item) => sum + item.confidence, 0) / 3 : undefined;

      const metrics = computeSkinMetrics(imageData, rois, { recentConfidenceAverage: recentConfidence });
      const smoothed = ema(metrics);

      history.push(smoothed);
      if (history.length > 20) {
        history.shift();
      }

      if (enableOverlay && overlayCanvas && overlayCtx && rois) {
        renderSkinOverlay(overlayCtx, overlayCanvas, rois, smoothed, videoWidth, videoHeight, true);
      }

      onUpdate(smoothed);
    } catch (error) {
      console.warn('[SkinAnalysis] Frame processing error:', error);
      onUpdate({
        texture: 50,
        redness: 50,
        shine: 50,
        overall: 50,
        confidence: 10,
        source: 'fallback'
      });
    }

    requestAnimationFrame(() => void processFrame());
  };

  requestAnimationFrame(() => void processFrame());
  return true;
}

export function stopSkinAnalysis(): void {
  isRunning = false;
  console.log('[SkinAnalysis] 🛑 Analysis stopped');
  teardownFaceMesh();
}

function resolveLandmarkSource(source: LandmarkSource | undefined): LandmarkPoint[] | null {
  if (!source) return null;
  if (typeof source === 'function') {
    try {
      return source() ?? null;
    } catch (error) {
      console.warn('[SkinAnalysis] Landmark provider error:', error);
      return null;
    }
  }
  return source;
}

function sanitizeLandmarks(landmarks: LandmarkPoint[] | null): number[][] | null {
  if (!landmarks) return null;
  const normalized: number[][] = [];
  for (const point of landmarks) {
    if (Array.isArray(point)) {
      const [x, y] = point;
      if (typeof x === 'number' && typeof y === 'number') {
        normalized.push([x, y]);
      }
    } else if (point && typeof point === 'object') {
      const maybeX = (point as { x?: number }).x;
      const maybeY = (point as { y?: number }).y;
      if (typeof maybeX === 'number' && typeof maybeY === 'number') {
        normalized.push([maybeX, maybeY]);
      }
    }
  }
  return normalized.length ? normalized : null;
}

async function ensureFaceMesh(): Promise<void> {
  if (faceMeshInstance || faceMeshLoader === null) {
    if (faceMeshInstance) return;
  }

  if (!faceMeshLoader) {
    faceMeshLoader = (async () => {
      try {
        const mod = await import('@mediapipe/face_mesh');
        const mesh = new mod.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        mesh.onResults((results: any) => {
          faceMeshProcessing = false;
          const landmarks = results?.multiFaceLandmarks?.[0];
          if (landmarks && Array.isArray(landmarks)) {
            faceMeshLastLandmarks = landmarks.map((point: any) => [point.x, point.y]);
          } else {
            faceMeshLastLandmarks = null;
          }
        });
        return mesh;
      } catch (error) {
        console.warn('[SkinAnalysis] Failed to load MediaPipe FaceMesh:', error);
        return null;
      }
    })();
  }

  faceMeshInstance = await faceMeshLoader;
}

async function runFaceMesh(videoEl: HTMLVideoElement): Promise<void> {
  await ensureFaceMesh();
  if (!faceMeshInstance || faceMeshProcessing) return;
  faceMeshProcessing = true;
  try {
    await faceMeshInstance.send({ image: videoEl });
  } catch (error) {
    faceMeshProcessing = false;
    console.warn('[SkinAnalysis] FaceMesh detection error:', error);
  }
}

function teardownFaceMesh(): void {
  if (faceMeshInstance?.close) {
    faceMeshInstance.close();
  }
  faceMeshInstance = null;
  faceMeshLoader = null;
  faceMeshProcessing = false;
  faceMeshLastLandmarks = null;
  faceMeshEnabled = false;
}

// Overlay rendering utilities -------------------------------------------------

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const HIGHLIGHT_COLORS = {
  texture: '#4A90E2',
  redness: '#F15B5D',
  oiliness: '#F5A623',
  dryness: '#66D9E8'
} as const;

function renderSkinOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  rois: ROIRegion,
  metrics: SkinMetrics,
  targetWidth: number,
  targetHeight: number,
  mirror = false
): void {
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const polygons: Partial<Record<OverlayRegionKey, Point2D[]>> = {};
  let highlightDrawn = false;

  for (const region of REGION_ORDER) {
    const roiPoints = rois[region];
    if (!roiPoints || roiPoints.length < 6) continue;

    const scaled = scaleNormalizedROI(roiPoints, targetWidth, targetHeight);
    let polygon = buildPolygon(scaled);
    if (mirror) polygon = mirrorPolygon(polygon, targetWidth);
    if (polygon.length < 3) continue;
    polygons[region] = polygon;

    const regionMetrics = metrics.regions?.[region];
    const highlight = determineRegionHighlight(region, regionMetrics);
    if (!highlight) continue;

    drawSeverityZone(ctx, polygon, highlight);
    highlightDrawn = true;
  }

  if (!highlightDrawn) {
    drawBaselineGuides(ctx, polygons);
  }

  drawOverlayLegend(ctx, canvas.width, canvas.height);
  ctx.restore();
}

const REGION_ORDER: OverlayRegionKey[] = ['forehead', 'leftCheek', 'rightCheek'];

function determineRegionHighlight(
  region: OverlayRegionKey,
  metrics?: { texture: number; redness: number; shine: number }
): RegionHighlight | null {
  if (!metrics) return null;

  const severityScores = {
    texture: clamp01((68 - metrics.texture) / 45),
    redness: clamp01((metrics.redness - 48) / 45),
    oiliness: clamp01((metrics.shine - 62) / 35),
    dryness: clamp01((42 - metrics.shine) / 22)
  };

  const candidates: Array<{ metric: keyof typeof severityScores; severity: number; color: string }> = [
    { metric: 'texture', severity: severityScores.texture, color: HIGHLIGHT_COLORS.texture },
    { metric: 'redness', severity: severityScores.redness, color: HIGHLIGHT_COLORS.redness },
    { metric: 'oiliness', severity: severityScores.oiliness, color: HIGHLIGHT_COLORS.oiliness },
    { metric: 'dryness', severity: severityScores.dryness, color: HIGHLIGHT_COLORS.dryness }
  ];

  const winner = candidates.reduce<{ metric: string; severity: number; color: string } | null>((top, candidate) => {
    if (candidate.severity <= 0.2) return top;
    if (!top || candidate.severity > top.severity) return candidate;
    return top;
  }, null);

  if (!winner) return null;
  return { severity: winner.severity, color: winner.color };
}

function drawSeverityZone(ctx: CanvasRenderingContext2D, polygon: Point2D[], highlight: RegionHighlight): void {
  const fillAlpha = 0.25 + highlight.severity * 0.45;
  const strokeAlpha = 0.6 + highlight.severity * 0.35;

  ctx.save();
  ctx.beginPath();
  polygon.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = hexToRgba(highlight.color, fillAlpha);
  ctx.strokeStyle = hexToRgba(highlight.color, strokeAlpha);
  ctx.shadowBlur = 12 * highlight.severity + 4;
  ctx.shadowColor = hexToRgba(highlight.color, 0.45 * highlight.severity);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBaselineGuides(
  ctx: CanvasRenderingContext2D,
  polygons: Partial<Record<OverlayRegionKey, Point2D[]>>
): void {
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;

  for (const region of REGION_ORDER) {
    const polygon = polygons[region];
    if (!polygon || polygon.length < 3) continue;

    ctx.beginPath();
    polygon.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    const color = baselineColor(region);
    ctx.fillStyle = hexToRgba(color, 0.12);
    ctx.strokeStyle = hexToRgba(color, 0.35);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function baselineColor(region: OverlayRegionKey): string {
  switch (region) {
    case 'forehead':
      return '#64748B';
    case 'leftCheek':
    case 'rightCheek':
      return '#60A5FA';
    default:
      return '#94A3B8';
  }
}

function drawOverlayLegend(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
  const items = [
    { label: 'Texture smoothing', color: HIGHLIGHT_COLORS.texture },
    { label: 'Redness relief', color: HIGHLIGHT_COLORS.redness },
    { label: 'Oil control', color: HIGHLIGHT_COLORS.oiliness },
    { label: 'Hydration boost', color: HIGHLIGHT_COLORS.dryness }
  ];

  const paddingX = 14;
  const paddingY = 10;
  const lineHeight = 18;
  const width = 190;
  const height = paddingY * 2 + items.length * lineHeight + 6;
  const x = 14;
  const y = canvasHeight - height - 14;

  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, x, y, width, height, 12);
  ctx.fillStyle = 'rgba(8, 12, 24, 0.68)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  ctx.font = '12px "Inter", Arial, sans-serif';
  items.forEach((item, index) => {
    const itemY = y + paddingY + index * lineHeight + 6;
    ctx.fillStyle = hexToRgba(item.color, 0.9);
    ctx.beginPath();
    ctx.arc(x + 12, itemY - 3, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(item.label, x + 24, itemY);
  });

  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function buildPolygon(points: number[]): Point2D[] {
  const polygon: Point2D[] = [];
  for (let i = 0; i < points.length; i += 2) {
    polygon.push({ x: points[i], y: points[i + 1] });
  }
  if (polygon.length < 3) return polygon;
  const hull = computeConvexHull(polygon);
  return hull.length >= 3 ? hull : polygon;
}

function computeConvexHull(points: Point2D[]): Point2D[] {
  const sorted = [...points]
    .filter((point, index, array) => array.findIndex(p => Math.abs(p.x - point.x) < 0.5 && Math.abs(p.y - point.y) < 0.5) === index)
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  if (sorted.length <= 3) return sorted;

  const cross = (o: Point2D, a: Point2D, b: Point2D) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point2D[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Point2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function mirrorPolygon(points: Point2D[], width: number): Point2D[] {
  return points.map(point => ({ x: Math.max(0, Math.min(width, width - point.x)), y: point.y }));
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

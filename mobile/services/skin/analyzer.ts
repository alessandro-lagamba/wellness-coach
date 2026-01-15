import { useEffect, useRef, useState } from 'react';

interface SkinRegionMetrics {
  texture: number;
  redness: number;
  shine: number;
}

export interface SkinMetrics {
  texture: number;
  redness: number;
  shine: number;
  overall: number;
  confidence: number;
  source: string;
  regions?: {
    leftCheek: SkinRegionMetrics;
    rightCheek: SkinRegionMetrics;
    forehead: SkinRegionMetrics;
  };
}

export type SkinAnalyzerStatus = 'idle' | 'analyzing' | 'fallback';

export interface SkinAnalyzerAdapter {
  start(onUpdate: (metrics: SkinMetrics) => void): void;
  stop(): void;
  getStatus(): SkinAnalyzerStatus;
}

export function createPlaceholderSkinAnalyzer(): SkinAnalyzerAdapter {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let status: SkinAnalyzerStatus = 'idle';
  let baseline = createBaselineMetrics();

  const tick = (emit: (metrics: SkinMetrics) => void) => {
    baseline = nextMetrics(baseline);
    emit(baseline);
  };

  return {
    start(onUpdate) {
      if (intervalId) return;
      status = 'analyzing';
      tick(onUpdate);
      intervalId = setInterval(() => tick(onUpdate), 1500);
    },
    stop() {
      status = 'idle';
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    getStatus() {
      return status;
    }
  };
}

export function useSkinAnalyzer(adapter: SkinAnalyzerAdapter) {
  const [metrics, setMetrics] = useState<SkinMetrics | null>(null);
  const [status, setStatus] = useState<SkinAnalyzerStatus>(adapter.getStatus());
  const adapterRef = useRef(adapter);

  useEffect(() => {
    const handle = adapterRef.current;
    handle.start((next) => {
      setMetrics(next);
      setStatus(handle.getStatus());
    });
    return () => {
      handle.stop();
      setStatus(handle.getStatus());
    };
  }, []);

  return { metrics, status } as const;
}

function createBaselineMetrics(): SkinMetrics {
  return {
    texture: 62,
    redness: 28,
    shine: 32,
    overall: 70,
    confidence: 82,
    source: 'mediapipe',
    regions: {
      leftCheek: { texture: 60, redness: 30, shine: 28 },
      rightCheek: { texture: 58, redness: 27, shine: 30 },
      forehead: { texture: 64, redness: 26, shine: 36 }
    }
  };
}

function nextMetrics(previous: SkinMetrics): SkinMetrics {
  const jitter = (value: number, delta: number) => {
    const next = value + (Math.random() - 0.5) * delta;
    return Math.round(Math.max(0, Math.min(100, next)));
  };

  const regions = {
    leftCheek: {
      texture: jitter(previous.regions?.leftCheek.texture ?? previous.texture, 4),
      redness: jitter(previous.regions?.leftCheek.redness ?? previous.redness, 4),
      hydration: jitter(previous.regions?.leftCheek.hydration ?? previous.hydration ?? 50, 5),
      oiliness: jitter(previous.regions?.leftCheek.oiliness ?? previous.oiliness ?? 50, 5)
    },
    rightCheek: {
      texture: jitter(previous.regions?.rightCheek.texture ?? previous.texture, 4),
      redness: jitter(previous.regions?.rightCheek.redness ?? previous.redness, 4),
      hydration: jitter(previous.regions?.rightCheek.hydration ?? previous.hydration ?? 50, 5),
      oiliness: jitter(previous.regions?.rightCheek.oiliness ?? previous.oiliness ?? 50, 5)
    },
    forehead: {
      texture: jitter(previous.regions?.forehead.texture ?? previous.texture, 4),
      redness: jitter(previous.regions?.forehead.redness ?? previous.redness, 4),
      hydration: jitter(previous.regions?.forehead.hydration ?? previous.hydration ?? 50, 5),
      oiliness: jitter(previous.regions?.forehead.oiliness ?? previous.oiliness ?? 50, 5)
    }
  } as const;

  const texture = Math.round((regions.leftCheek.texture + regions.rightCheek.texture + regions.forehead.texture) / 3);
  const redness = Math.round((regions.leftCheek.redness + regions.rightCheek.redness) / 2);
  const hydration = Math.round((regions.leftCheek.hydration + regions.rightCheek.hydration + regions.forehead.hydration) / 3);
  const oiliness = Math.round((regions.leftCheek.oiliness + regions.rightCheek.oiliness + regions.forehead.oiliness) / 3);
  const overall = Math.round(texture * 0.25 + (100 - redness) * 0.30 + hydration * 0.25 + (100 - oiliness) * 0.20);
  const confidence = jitter(previous.confidence, 2);

  return {
    texture,
    redness,
    hydration,
    oiliness,
    overall,
    confidence,
    source: previous.source,
    regions
  };
}

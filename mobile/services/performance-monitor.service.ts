import { AnalyticsService } from './analytics.service';
import { AnalysisResponse } from '../types/analysis.types';

export type AnalysisSource = 'camera' | 'gallery' | 'manual';

interface TraceOptions {
  source?: AnalysisSource;
  featureName?: string;
  thresholdMs?: number;
}

const DEFAULT_THRESHOLD = 5000;

const now =
  typeof globalThis.performance?.now === 'function'
    ? () => globalThis.performance!.now()
    : () => Date.now();

/**
 * Wrap an analysis operation with performance+analytics instrumentation.
 */
export async function traceAnalysis<T>(
  analysisType: 'emotion' | 'skin' | 'food',
  operation: () => Promise<AnalysisResponse<T>>,
  options: TraceOptions = {}
): Promise<AnalysisResponse<T>> {
  const source = options.source || 'camera';
  const featureName = options.featureName || `${analysisType}_analysis`;
  const thresholdMs = options.thresholdMs || DEFAULT_THRESHOLD;

  await AnalyticsService.trackAnalysisStarted(analysisType, source);

  const start = now();

  try {
    const result = await operation();
    const duration = now() - start;

    if (result?.success) {
      await AnalyticsService.trackAnalysisCompleted(analysisType, duration, source);
      await AnalyticsService.trackPerformanceIssue(featureName, duration, thresholdMs);
    } else {
      const errorMessage = result?.error || 'Unknown analysis error';
      await AnalyticsService.trackAnalysisError(analysisType, `${featureName}_failed`, errorMessage);
      await AnalyticsService.trackPerformanceIssue(`${featureName}_failed`, duration, thresholdMs);
    }

    return result;
  } catch (error: any) {
    const duration = now() - start;
    const message = error?.message || 'Analysis exception';
    await AnalyticsService.trackAnalysisError(analysisType, `${featureName}_exception`, message);
    await AnalyticsService.trackPerformanceIssue(`${featureName}_exception`, duration, thresholdMs);
    throw error;
  }
}

/**
 * Utility to log generic performance metrics (non-analysis).
 */
export async function traceOperation(
  featureName: string,
  operation: () => Promise<void>,
  thresholdMs: number = DEFAULT_THRESHOLD
) {
  const start = now();
  await operation();
  const duration = now() - start;
  await AnalyticsService.trackPerformanceIssue(featureName, duration, thresholdMs);
}



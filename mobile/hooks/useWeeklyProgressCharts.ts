import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChartType, ChartConfig } from '../services/chart-config.service';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Types for health data
interface HealthData {
    steps?: number;
    sleepHours?: number;
    sleepQuality?: number;
    hrv?: number;
    heartRate?: number;
    restingHeartRate?: number;
    hydration?: number;
    mindfulnessMinutes?: number;
}

interface WeeklyTrendData {
    steps: number[];
    sleepHours: number[];
    hrv: number[];
    heartRate: number[];
    hydration: number[];
    meditation: number[];
}

interface PlaceholderChartSamples {
    [key: string]: {
        value: number;
        trend: number[];
        max: number;
    };
}

import { ImageSourcePropType } from 'react-native';

export interface WeeklyChartVM {
    id: ChartType;
    enabled: boolean;
    canRender: boolean;
    title: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    iconImage?: ImageSourcePropType;
    color: string;
    valueText: string;
    unitText?: string;
    subtitleText: string;
    trendData: number[];
    maxValue: number;
    rawValue: number;
    formatValue: (v: number) => string;
}

interface ChartMetadata {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    iconImage?: ImageSourcePropType;
    color: string;
    defaultMax: number;
    roundStep: number;
}

const CHART_METADATA: Record<ChartType, ChartMetadata> = {
    steps: {
        icon: 'walk',
        iconImage: require('../assets/images/widgets_logos/steps.png'),
        color: '#10b981',
        defaultMax: 10000,
        roundStep: 5000
    },
    sleepHours: {
        icon: 'sleep',
        iconImage: require('../assets/images/widgets_logos/sleep.png'),
        color: '#6366f1',
        defaultMax: 10,
        roundStep: 2
    },
    hrv: {
        icon: 'heart-pulse',
        iconImage: require('../assets/images/widgets_logos/hrv.png'),
        color: '#ef4444',
        defaultMax: 100,
        roundStep: 25
    },
    heartRate: {
        icon: 'heart',
        iconImage: require('../assets/images/widgets_logos/hrv.png'), // Heart rate uses same icon as HRV usually or similar
        color: '#ef4444',
        defaultMax: 100,
        roundStep: 25
    },
    hydration: {
        icon: 'cup-water',
        iconImage: require('../assets/images/widgets_logos/hydration.png'),
        color: '#3b82f6',
        defaultMax: 8,
        roundStep: 2
    },
    meditation: {
        icon: 'meditation',
        iconImage: require('../assets/images/widgets_logos/meditation.png'),
        color: '#8b5cf6',
        defaultMax: 30,
        roundStep: 15
    },
};

/**
 * Helper to fill trend data to 7 days and update with today's value
 */
function prepareTrendData(weeklyData: number[], todayValue: number): number[] {
    const chartData = [...weeklyData];
    if (chartData.length > 0) {
        chartData[chartData.length - 1] = todayValue;
    } else {
        chartData.push(todayValue);
    }
    while (chartData.length < 7) {
        chartData.unshift(0);
    }
    return chartData.slice(-7);
}

/**
 * Helper to calculate maxValue with proper rounding
 */
function calculateMaxValue(
    weeklyData: number[],
    todayValue: number,
    defaultMax: number,
    roundStep: number
): number {
    const allValues = [...weeklyData, todayValue].filter(v => v > 0);
    if (allValues.length === 0) return defaultMax;
    const max = Math.max(...allValues);
    return Math.ceil(max / roundStep) * roundStep || defaultMax;
}

// Widget data type for getting today's values
interface WidgetDataItem {
    id: string;
    // Common fields - 🔥 Updated to match HomeScreen structure
    steps?: { current: number };
    sleep?: { hours: number };
    hrv?: { value: number };
    heartRate?: number;
    // Specific fields
    hydration?: { ml: number; glasses: number };
    meditation?: { minutes: number };
}

interface UseWeeklyProgressChartsParams {
    enabledCharts: ChartConfig[];
    disabledCharts: ChartConfig[];
    isHealthDataReady: boolean;
    healthData: HealthData | null;
    weeklyTrendData: WeeklyTrendData;
    placeholderChartSamples: PlaceholderChartSamples;
    widgetData?: WidgetDataItem[]; // 🔥 FIX: Add widgetData for today's values
}

export function useWeeklyProgressCharts({
    enabledCharts,
    disabledCharts,
    isHealthDataReady,
    healthData,
    weeklyTrendData,
    placeholderChartSamples,
    widgetData = [], // 🔥 FIX: Default to empty array
}: UseWeeklyProgressChartsParams): {
    enabledChartsVM: WeeklyChartVM[];
    disabledChartsVM: WeeklyChartVM[];
} {
    const { t } = useTranslation();

    return useMemo(() => {
        const buildChartVM = (config: ChartConfig): WeeklyChartVM | null => {
            const { id } = config;
            const meta = CHART_METADATA[id];
            if (!meta) return null;

            // Build chart-specific data
            switch (id) {
                case 'steps': {
                    // Try to get data from HealthData first, then WidgetData
                    const widgetInfo = widgetData.find(w => w.id === 'steps');
                    const widgetValue = widgetInfo?.steps?.current || 0;

                    const healthValue = healthData?.steps || 0;
                    const rawValue = isHealthDataReady && healthValue > 0 ? healthValue : (widgetValue > 0 ? widgetValue : placeholderChartSamples.steps.value);

                    const shouldRender = rawValue > 0 || isHealthDataReady; // Render if we have data or if ready

                    const trendData = isHealthDataReady || rawValue > 0
                        ? prepareTrendData(weeklyTrendData.steps, rawValue)
                        : placeholderChartSamples.steps.trend;

                    const maxValue = (isHealthDataReady || rawValue > 0)
                        ? calculateMaxValue(weeklyTrendData.steps, rawValue, meta.defaultMax, meta.roundStep)
                        : placeholderChartSamples.steps.max;

                    return {
                        id,
                        enabled: config.enabled,
                        canRender: shouldRender,
                        title: t('widgets.steps'),
                        icon: meta.icon,
                        iconImage: meta.iconImage,
                        color: meta.color,
                        valueText: rawValue.toLocaleString(),
                        unitText: t('home.weeklyProgress.steps') || 'passi',
                        subtitleText: t('home.weeklyProgress.today'),
                        trendData,
                        maxValue,
                        rawValue,
                        formatValue: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString(),
                    };
                }

                case 'sleepHours': {
                    // Try to get data from HealthData first, then WidgetData
                    const widgetInfo = widgetData.find(w => w.id === 'sleep');
                    const widgetValue = widgetInfo?.sleep?.hours || 0; // 🔥 FIX: Access nested property

                    const healthValue = healthData?.sleepHours || 0;
                    // Priority: HealthData -> WidgetData -> Placeholder
                    const rawValue = (isHealthDataReady && healthValue > 0) ? healthValue : (widgetValue > 0 ? widgetValue : placeholderChartSamples.sleepHours.value);

                    const shouldRender = isHealthDataReady || rawValue > 0;
                    if (!shouldRender) return null;

                    const trendData = (isHealthDataReady || rawValue > 0)
                        ? prepareTrendData(weeklyTrendData.sleepHours, rawValue)
                        : placeholderChartSamples.sleepHours.trend;
                    const maxValue = (isHealthDataReady || rawValue > 0)
                        ? calculateMaxValue(weeklyTrendData.sleepHours, rawValue, meta.defaultMax, meta.roundStep)
                        : placeholderChartSamples.sleepHours.max;

                    const sleepQuality = healthData?.sleepQuality;
                    const subtitleText = sleepQuality
                        ? `${Math.round(sleepQuality)}% ${t('home.weeklyProgress.quality')}`
                        : t('home.weeklyProgress.today');

                    return {
                        id,
                        enabled: config.enabled,
                        canRender: shouldRender,
                        title: t('widgets.sleep'),
                        icon: meta.icon,
                        iconImage: meta.iconImage,
                        color: meta.color,
                        valueText: rawValue ? `${Math.round(rawValue * 10) / 10}` : '—',
                        unitText: rawValue ? 'h' : '',
                        subtitleText,
                        trendData,
                        maxValue,
                        rawValue,
                        formatValue: (v: number) => `${v.toFixed(1)}h`,
                    };
                }

                case 'hrv': {
                    const widgetInfo = widgetData.find(w => w.id === 'hrv');
                    const widgetValue = widgetInfo?.hrv?.value || 0; // 🔥 FIX: Access nested property

                    const healthValue = healthData?.hrv || 0;
                    const rawValue = isHealthDataReady && healthValue > 0 ? healthValue : (widgetValue > 0 ? widgetValue : placeholderChartSamples.hrv.value);

                    const shouldRender = rawValue > 0 || isHealthDataReady; // Always try to render if possible

                    const trendData = (isHealthDataReady || rawValue > 0)
                        ? prepareTrendData(weeklyTrendData.hrv, rawValue)
                        : placeholderChartSamples.hrv.trend;
                    const maxValue = (isHealthDataReady || rawValue > 0)
                        ? calculateMaxValue(weeklyTrendData.hrv, rawValue, meta.defaultMax, meta.roundStep)
                        : placeholderChartSamples.hrv.max;

                    return {
                        id,
                        enabled: config.enabled,
                        canRender: shouldRender,
                        title: t('widgets.hrv'),
                        icon: meta.icon,
                        iconImage: meta.iconImage,
                        color: meta.color,
                        valueText: (rawValue <= 0) ? '--' : (rawValue >= 100 ? Math.round(rawValue).toString() : (Math.round(rawValue * 10) / 10).toString()),
                        unitText: (rawValue <= 0) ? '' : 'ms',
                        subtitleText: t('home.weeklyProgress.current'),
                        trendData,
                        maxValue,
                        rawValue,
                        formatValue: (v: number) => v >= 100 ? Math.round(v).toString() : v.toFixed(1),
                    };
                }

                case 'heartRate': {
                    const shouldRender = isHealthDataReady ? (healthData?.heartRate ?? 0) > 0 : true;
                    if (!shouldRender) return null;

                    const rawValue = isHealthDataReady ? (healthData?.heartRate || 0) : placeholderChartSamples.heartRate.value;
                    const trendData = isHealthDataReady
                        ? prepareTrendData(weeklyTrendData.heartRate, rawValue)
                        : placeholderChartSamples.heartRate.trend;
                    const maxValue = isHealthDataReady
                        ? calculateMaxValue(weeklyTrendData.heartRate, rawValue, meta.defaultMax, meta.roundStep)
                        : placeholderChartSamples.heartRate.max;

                    const restingHR = healthData?.restingHeartRate;
                    const subtitleText = (restingHR !== undefined && restingHR !== null)
                        ? `${t('home.hrv.restingHR')}: ${restingHR > 0 ? Math.round(restingHR) : '--'} ${t('home.bpm')}`
                        : t('home.weeklyProgress.current');

                    return {
                        id,
                        enabled: config.enabled,
                        canRender: shouldRender,
                        title: t('home.weeklyProgress.heartRate'),
                        icon: meta.icon,
                        iconImage: meta.iconImage,
                        color: meta.color,
                        valueText: Math.round(rawValue).toString(),
                        unitText: t('home.bpm'),
                        subtitleText,
                        trendData,
                        maxValue,
                        rawValue,
                        formatValue: (v: number) => `${Math.round(v)}`,
                    };
                }

                case 'hydration': {
                    // 🔥 FIX: Use widgetData for today's values (contains real data from DB)
                    const hydrationWidget = widgetData.find(w => w.id === 'hydration');
                    const todayHydrationMl = hydrationWidget?.hydration?.ml || 0;
                    const todayHydrationGlasses = Math.round(todayHydrationMl / 250);

                    // Use trend data for historical values, but today's value from widget
                    const trendData = prepareTrendData(
                        weeklyTrendData.hydration.map(v => Math.round(v / 250)),
                        todayHydrationGlasses
                    );
                    const maxValue = calculateMaxValue(
                        weeklyTrendData.hydration.map(v => Math.round(v / 250)),
                        todayHydrationGlasses,
                        meta.defaultMax,
                        meta.roundStep
                    );

                    const subtitleText = todayHydrationMl > 0
                        ? `${(todayHydrationMl / 1000).toFixed(1)} L`
                        : t('home.weeklyProgress.today');

                    return {
                        id,
                        enabled: config.enabled,
                        canRender: true,
                        title: t('widgets.hydration'),
                        icon: meta.icon,
                        iconImage: meta.iconImage,
                        color: meta.color,
                        valueText: todayHydrationGlasses.toString(),
                        unitText: t('home.glasses'),
                        subtitleText,
                        trendData,
                        maxValue,
                        rawValue: todayHydrationMl,
                        formatValue: (v: number) => `${Math.round(v)}`,
                    };
                }

                case 'meditation': {
                    // 🔥 FIX: Use widgetData for today's values (contains real data from DB)
                    const meditationWidget = widgetData.find(w => w.id === 'meditation');
                    const todayMeditationMinutes = meditationWidget?.meditation?.minutes || 0;

                    // Use trend data for historical values, but today's value from widget
                    const trendData = prepareTrendData(weeklyTrendData.meditation, todayMeditationMinutes);
                    const maxValue = calculateMaxValue(weeklyTrendData.meditation, todayMeditationMinutes, meta.defaultMax, meta.roundStep);

                    return {
                        id,
                        enabled: config.enabled,
                        canRender: true,
                        title: t('widgets.meditation'),
                        icon: meta.icon,
                        iconImage: meta.iconImage,
                        color: meta.color,
                        valueText: todayMeditationMinutes.toString(),
                        unitText: t('home.minutes'),
                        subtitleText: t('home.weeklyProgress.today'),
                        trendData,
                        maxValue,
                        rawValue: todayMeditationMinutes,
                        formatValue: (v: number) => `${Math.round(v)}`,
                    };
                }

                default:
                    return null;
            }
        };

        const enabledChartsVM = enabledCharts
            .map(buildChartVM)
            .filter((vm): vm is WeeklyChartVM => vm !== null);

        const disabledChartsVM = disabledCharts
            .map(buildChartVM)
            .filter((vm): vm is WeeklyChartVM => vm !== null);

        return { enabledChartsVM, disabledChartsVM };
    }, [
        enabledCharts,
        disabledCharts,
        isHealthDataReady,
        healthData,
        weeklyTrendData,
        placeholderChartSamples,
        widgetData, // 🔥 FIX: Add widgetData to deps for instant updates
        t,
    ]);
}

export default useWeeklyProgressCharts;

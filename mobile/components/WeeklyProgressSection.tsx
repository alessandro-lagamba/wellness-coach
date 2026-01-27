import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { WeeklyProgressCard } from './WeeklyProgressCard';
import { useWeeklyProgressCharts, WeeklyChartVM } from '../hooks/useWeeklyProgressCharts';
import { ChartType, ChartConfig } from '../services/chart-config.service';

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

// Widget data item type
interface WidgetDataItem {
    id: string;
    hydration?: { ml: number; glasses: number };
    meditation?: { minutes: number };
}

export interface WeeklyProgressSectionProps {
    // Data
    enabledCharts: ChartConfig[];
    disabledCharts: ChartConfig[];
    availableChartsList: ChartType[];
    isHealthDataReady: boolean;
    healthData: HealthData | null;
    weeklyTrendData: WeeklyTrendData;
    placeholderChartSamples: PlaceholderChartSamples;
    widgetData?: WidgetDataItem[]; // 🔥 FIX: Add widgetData for today's values

    // Edit mode
    chartEditMode: boolean;
    setChartEditMode: (mode: boolean) => void;

    // Actions
    onChartPress: (chartType: ChartType, currentValue: number, color: string) => void;
    onChartSelectionOpen: () => void;
    toggleChart: (chartId: ChartType) => void;
    enableChart: (chartId: ChartType) => void;
    onPermissionRequest: () => void; // 🔥 New prop
}

export const WeeklyProgressSection: React.FC<WeeklyProgressSectionProps> = ({
    enabledCharts,
    disabledCharts,
    availableChartsList,
    isHealthDataReady,
    healthData,
    weeklyTrendData,
    placeholderChartSamples,
    widgetData = [], // 🔥 FIX: Default to empty array
    chartEditMode,
    setChartEditMode,
    onChartPress,
    onChartSelectionOpen,
    toggleChart,
    enableChart,
    onPermissionRequest,
}) => {
    const { t } = useTranslation();
    const { colors: themeColors } = useTheme();
    const [isExpanded, setIsExpanded] = React.useState(false);

    // Use the hook to get processed chart data
    const { enabledChartsVM, disabledChartsVM } = useWeeklyProgressCharts({
        enabledCharts,
        disabledCharts,
        isHealthDataReady,
        healthData,
        weeklyTrendData,
        placeholderChartSamples,
        widgetData, // 🔥 FIX: Pass widgetData to hook
    });

    const renderChartCard = (vm: WeeklyChartVM) => (
        <WeeklyProgressCard
            key={vm.id}
            id={vm.id}
            title={vm.title}
            icon={vm.icon}
            iconImage={vm.iconImage}
            color={vm.color}
            valueText={vm.valueText}
            unitText={vm.unitText}
            subtitleText={vm.subtitleText}
            trendData={vm.trendData}
            maxValue={vm.maxValue}
            formatValue={vm.formatValue}
            onPress={() => onChartPress(vm.id, vm.rawValue, vm.color)}
            editMode={false} // Disable edit mode UI
            onDisable={() => toggleChart(vm.id)}
            disabled={!isHealthDataReady}
            onDisabledPress={onPermissionRequest} // 🔥 Trigger modal on disabled click
        />
    );

    return (
        <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]} allowFontScaling={false}>
                {t('home.weeklyProgress.title')}
            </Text>

            <View
                style={[
                    styles.mainContainer,
                    {
                        backgroundColor: themeColors.surface,
                        borderColor: themeColors.border
                    }
                ]}
            >
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setIsExpanded(!isExpanded)}
                    style={styles.headerTrigger}
                >
                    <View style={styles.subtitleRow}>
                        <View style={[styles.iconContainer, { backgroundColor: themeColors.primary + '15' }]}>
                            <MaterialCommunityIcons
                                name="trending-up"
                                size={20}
                                color={themeColors.primary}
                            />
                        </View>
                        <Text style={[styles.sectionSubtitle, { color: themeColors.text, fontSize: 18, flex: 1, fontFamily: 'Figtree_700Bold' }]} allowFontScaling={false}>
                            {t('home.weeklyProgress.subtitle') || 'Scopri quanto sei migliorato'}
                        </Text>
                        <MaterialCommunityIcons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={24}
                            color={themeColors.textTertiary}
                        />
                    </View>
                </TouchableOpacity>

                {/* Charts Container - Inside the main box */}
                {isExpanded && (
                    <View style={styles.chartsInside}>
                        {/* Show all charts: enabled first, then disabled */}
                        {enabledChartsVM.map(renderChartCard)}
                        {disabledChartsVM.map(renderChartCard)}

                        {enabledChartsVM.length === 0 && disabledChartsVM.length === 0 && (
                            <View style={[styles.emptyCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                                <Text style={[styles.emptyCardText, { color: themeColors.textSecondary }]}>
                                    {t('home.weeklyProgress.noCharts') || 'Nessun grafico disponibile.'}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    sectionHeader: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontFamily: 'Figtree_700Bold',
        marginBottom: 16,
    },
    mainContainer: {
        borderRadius: 24,
        borderWidth: 1,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
    },
    headerTrigger: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 30,
        height: 30,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    sectionSubtitle: {
        fontSize: 15,
        lineHeight: 22,
        fontFamily: 'Figtree_500Medium',
    },
    chartsInside: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    emptyCard: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    emptyCardText: {
        fontSize: 14,
        textAlign: 'center',
    },
});

export default WeeklyProgressSection;

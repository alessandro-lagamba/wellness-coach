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
}) => {
    const { t } = useTranslation();
    const { colors: themeColors } = useTheme();

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
            color={vm.color}
            valueText={vm.valueText}
            unitText={vm.unitText}
            subtitleText={vm.subtitleText}
            trendData={vm.trendData}
            maxValue={vm.maxValue}
            formatValue={vm.formatValue}
            onPress={() => onChartPress(vm.id, vm.rawValue, vm.color)}
            editMode={chartEditMode}
            onDisable={() => toggleChart(vm.id)}
            disabled={!isHealthDataReady}
        />
    );

    return (
        <>
            {/* Section Header */}
            <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderContent}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                            {t('home.weeklyProgress.title') || 'I tuoi progressi questa settimana'}
                        </Text>
                        <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                            {t('home.weeklyProgress.subtitle') || 'Un riepilogo dei tuoi miglioramenti'}
                        </Text>
                    </View>
                    <View style={styles.headerActions}>
                        {chartEditMode ? (
                            <>
                                {availableChartsList.length > 0 && (
                                    <TouchableOpacity
                                        onPress={onChartSelectionOpen}
                                        style={[styles.addChartButton, { backgroundColor: themeColors.primary, borderColor: themeColors.primaryDark }]}
                                    >
                                        <FontAwesome name="plus" size={14} color="#ffffff" />
                                        <Text style={styles.addChartButtonText}>{t('home.addChart')}</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={() => setChartEditMode(false)}
                                    style={styles.exitEditButton}
                                >
                                    <Text style={styles.exitEditButtonText}>{t('home.done')}</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setChartEditMode(true)}
                                style={[
                                    styles.editModeButton,
                                    {
                                        backgroundColor: themeColors.primary,
                                        borderColor: themeColors.primaryDark,
                                    }
                                ]}
                            >
                                <Text style={styles.editModeButtonText}>{t('home.edit')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* Charts Container */}
            <View style={styles.weeklyProgressContainer}>
                {enabledChartsVM.length === 0 && !chartEditMode ? (
                    <View style={[styles.emptyCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                        <Text style={[styles.emptyCardText, { color: themeColors.textSecondary }]}>
                            {t('home.weeklyProgress.noCharts') || 'Nessun grafico abilitato. Usa il pulsante "Modifica" per abilitare i grafici.'}
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Enabled Charts */}
                        {enabledChartsVM.map(renderChartCard)}

                        {/* Disabled Charts (in edit mode) */}
                        {chartEditMode && disabledChartsVM.length > 0 && (
                            <View style={styles.disabledChartsContainer}>
                                <Text style={[styles.disabledChartsTitle, { color: themeColors.textSecondary }]}>
                                    {t('home.weeklyProgress.disabledCharts') || 'Grafici disabilitati'}
                                </Text>
                                {disabledChartsVM.map((vm) => (
                                    <TouchableOpacity
                                        key={vm.id}
                                        onPress={() => enableChart(vm.id)}
                                        style={[styles.disabledChartCard, { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border }]}
                                    >
                                        <MaterialCommunityIcons name={vm.icon} size={20} color={vm.color} />
                                        <Text style={[styles.disabledChartLabel, { color: themeColors.text }]}>{vm.title}</Text>
                                        <FontAwesome name="plus-circle" size={18} color={themeColors.primary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    sectionHeader: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 8,
    },
    sectionHeaderContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        lineHeight: 18,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addChartButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        gap: 6,
    },
    addChartButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    exitEditButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#10b981',
    },
    exitEditButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
    editModeButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    editModeButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    weeklyProgressContainer: {
        paddingHorizontal: 20,
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
    disabledChartsContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(128, 128, 128, 0.2)',
    },
    disabledChartsTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    disabledChartCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        gap: 10,
    },
    disabledChartLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
});

export default WeeklyProgressSection;

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MiniTrendChart } from './MiniTrendChart';
import { useTheme } from '../contexts/ThemeContext';
import { ChartType } from '../services/chart-config.service';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 72; // Screen width - (2 * sectionPadding 20) - (2 * cardPadding 16)

export interface WeeklyProgressCardProps {
    id: ChartType;
    title: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
    valueText: string;
    unitText?: string;
    subtitleText: string;
    trendData: number[];
    maxValue: number;
    formatValue?: (v: number) => string;
    onPress?: () => void;
    editMode?: boolean;
    onDisable?: () => void;
    disabled?: boolean;
}

export const WeeklyProgressCard: React.FC<WeeklyProgressCardProps> = ({
    id,
    title,
    icon,
    color,
    valueText,
    unitText,
    subtitleText,
    trendData,
    maxValue,
    formatValue = (v) => v.toString(),
    onPress,
    editMode = false,
    onDisable,
    disabled = false,
}) => {
    const { colors: themeColors } = useTheme();

    return (
        <TouchableOpacity
            key={id}
            style={[styles.progressCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={() => !editMode && !disabled && onPress?.()}
            activeOpacity={editMode ? 1 : 0.7}
            disabled={editMode || disabled}
        >
            <View style={styles.progressCardHeader}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
                <Text style={[styles.progressCardTitle, { color: themeColors.text }]}>
                    {title}
                </Text>
                {editMode && onDisable && (
                    <TouchableOpacity
                        onPress={onDisable}
                        style={[styles.chartEditButton, { backgroundColor: themeColors.error + '20' }]}
                    >
                        <FontAwesome name="times" size={14} color={themeColors.error} />
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.progressCardContent}>
                <MiniTrendChart
                    data={trendData}
                    color={color}
                    maxValue={maxValue}
                    formatValue={formatValue}
                    width={CHART_WIDTH}
                />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    progressCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    progressCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressCardTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 10,
        flex: 1,
    },
    chartEditButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressCardContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default WeeklyProgressCard;
